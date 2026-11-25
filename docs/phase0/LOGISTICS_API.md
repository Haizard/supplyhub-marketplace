# Logistics API (v1)

All endpoints are dynamic (`no-store`) and sit under `/api/v1/logistics/`. They are
available only when the `phase9.logisticsNetwork` feature flag is enabled.

## Authentication

Every request uses a company API key:

```
Authorization: Bearer lsk_<keyId>.<secret>
```

The key is hashed with HMAC-SHA256 using a server-derived secret; only the hash is
stored. The company is resolved from the key — a client cannot supply a `companyId`.
Each key carries explicit scopes:

| Scope | Purpose |
|---|---|
| `delivery.requests:write` | Create delivery requests |
| `delivery.requests:read` | Read request status |
| `webhooks:write` | Reserved for future webhook management |

Keys are per-process rate limited to 120 requests/minute; inbound store webhooks are
limited to 240/minute per address. A multi-instance deployment must move these limits
to a shared store.

## Endpoints

### `POST /api/v1/logistics/delivery-requests`

Requires `delivery.requests:write` and an `Idempotency-Key` header (max 160 chars).
Body: `externalRef`, `pickupName`, `pickupPhone?`, `pickupAddress`,
`pickup { latitude, longitude }`, `dropoffName`, `dropoffPhone?`, `dropoffAddress`,
`dropoff { latitude, longitude }`, `currency`, `note?`.

- `201` on first creation with `{ requestId, requestNumber, status: "PENDING", replayed: false }`.
- `200` on a replay with the same idempotency key and identical body, `replayed: true`.
- `409` if the idempotency key was reused with a different body, or `externalRef`
  belongs to another company.
- `400` for invalid JSON/body or a missing idempotency key; `401`/`403` for auth/scope;
  `429` when rate limited.

Replaying an idempotent request does not emit another webhook.

### `GET /api/v1/logistics/delivery-requests/[externalRef]`

Requires `delivery.requests:read`. Returns `{ id, requestId, requestNumber, status,
externalRef, createdAt }`. A company can only read its own requests (`404` otherwise).
The active job status is reported when a job exists.

### `POST /api/v1/logistics/webhooks/orders`

Inbound signed webhook from a registered external store. Headers:

- `X-SupplyHub-Store-Id` — the registered store UUID.
- `X-SupplyHub-Timestamp` — Unix seconds; tolerance ±5 minutes.
- `X-SupplyHub-Signature` — `sha256=hex(HMAC-SHA256(secret, timestamp + "." + rawBody))`.

The secret is encrypted at rest (AES-256-GCM with a key derived from `AUTH_SECRET`) and
shown once when the store is connected. Body fields match `externalOrderSchema`:
`externalOrderId`, `customerName`, `customerPhone?`, pickup/dropoff names, addresses
and coordinates, `currency`, `fee`, `distanceKm`, `note?`.

Responses: `200 { orderId, status: "RECEIVED" }`, `400` invalid body, `401` invalid
signature, `404` unknown/disconnected store, `413` payload over 32 KB, `429` rate limited.
Orders are deduplicated by `(storeId, externalOrderId)`.

## Outbound webhooks

Companies register HTTPS endpoints and subscribe to `delivery.created`,
`delivery.status_changed` and `delivery.delivered`. Each delivery is signed with the
same scheme as inbound webhooks (`X-SupplyHub-Signature`, `X-SupplyHub-Timestamp`,
`X-SupplyHub-Event`). Deliveries are recorded with bounded exponential retries (max 5
attempts). An administrator can drain the queue via
`POST /api/admin/logistics-webhooks/dispatch` (session auth required). Delivery records
never include secrets; only the signature header does.

## Security notes

- No client-supplied role, company ID, price or status is trusted.
- Webhook bodies are size-capped, JSON-parsed only after signature verification, and
  deduplicated by unique keys.
- Secrets are never logged or returned after initial creation.
- The platform does not hold or move third-party money; fees in webhook payloads are
  informational contract data, not provider settlement.
