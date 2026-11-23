# Logistics Business Network — Technical Implementation Proposal

**Status: PROPOSED — not started. No code has been changed for this domain.**

This document is the repository-first technical proposal requested for the Logistics
Business Network (LBN). It grounds the strategy in the code that already exists,
defines the data/ownership decisions, maps the requested tables to reuse versus new
work, and proposes an incremental delivery sequence. Implementation begins only after
the first slice is approved.

---

## 1. Strategic summary

Today SupplyHub has a **platform-dispatched courier network**: independent agents,
admin-run dispatch, OTP hand-over, proof of delivery, tracking and per-job earnings.
The proposal turns that into a **network of independent logistics companies** that
can:

- run their own fleet, drivers, branches and service zones;
- acquire and serve their own merchant clients, including merchants that never list
  on the marketplace;
- sign and monitor commercial delivery contracts with SLAs;
- accept platform-generated delivery opportunities without giving up their own
  customers;
- earn referral rewards for bringing verified, transacting merchants into the wider
  platform.

The commercial loop is important but must be sequenced correctly: **attribution and
contracts before rewards**. Paying for registrations before verified commercial
activity would create fraud and cost with no network effect.

---

## 2. Repository-first findings (what already exists)

These are the exact identifiers found in the current tree. The proposal builds on
them; it does not replace them.

### 2.1 Existing delivery engine (Phase 4)

- Models: `DeliveryAgent`, `DeliveryVehicle`, `AgentDocument`, `AgentServiceArea`,
  `DeliveryPricingRule`, `DeliveryRequest`, `DeliveryJob`, `DeliveryAssignment`,
  `DeliveryStatusHistory`, `DeliveryLocation`, `DeliveryProof`, `AgentEarning`,
  `DeliveryCommission`.
- Enums: `AgentVerificationStatus`, `AgentPresence`, `DeliveryVehicleType`
  (`BICYCLE, MOTORCYCLE, CAR, VAN, WALKING`), `AgentDocumentType`,
  `VerificationState`, `DeliveryRequestStatus`, `DeliveryJobStatus`
  (`ASSIGNED, ACCEPTED, TO_PICKUP, AT_PICKUP, TRANSIT, DELIVERED, CANCELLED`),
  `DeliveryProofType`, `AgentEarningStatus`.
- State machine and authorization: `src/features/logistics/status.ts`
  (`JOB_TRANSITIONS`, `canTransitionJob`, `canActorTransition`). Forward-only;
  enforced in `src/features/logistics/actions.ts::transitionJob` inside a transaction
  with optimistic concurrency via `updateMany({ where: { id, status } })`, plus an
  append-only `DeliveryStatusHistory` row.
- Dispatch: `src/features/logistics/dispatch.ts` — `haversineKm`, `scoreCandidate`,
  `pickBestAgent`, weights `{ proximity: 40, rating: 20, experience: 15,
  serviceArea: 15, availability: 10 }`. Admin-only entry point
  `dispatchDeliveryAction`.
- Hand-over: `src/features/logistics/otp.ts` — 6-digit codes, 60-minute TTL,
  separate `verifyHandoverAction` and `recordProofAction` for `PHOTO`/`SIGNATURE`.
- External API: `POST/GET /api/delivery/requests`, idempotent on
  `DeliveryRequest.externalRef`; tracking at
  `GET /api/delivery/jobs/[jobId]/track`; courier GPS at
  `POST /api/courier/jobs/[jobId]/location`. All use `await connection()` and
  `Cache-Control: no-store`.
- Per-job economics: on `DELIVERED`, `commissionRateBps = 1500` (documented
  configurable default), `delivery_commissions` and immutable `agent_earnings` rows
  are created. This ledger is deliberately separate from the payment
  `CommissionLedger`.
- UI: `/courier`, `/delivery`, `/delivery/request`, `/delivery/track/[jobId]`,
  `/admin/delivery`. The old client-side map simulation is retired; `/delivery-live`
  resolves to the database-backed views.

### 2.2 Existing organization and permission infrastructure

- `Business`, `BusinessMember`, `BusinessRole`, `MemberRole`, `Permission`,
  `RolePermission`, `BusinessBranch`, `BusinessDocument`, `BusinessSettings`.
- `src/server/business/permissions.ts` (pure, unit-tested): `BusinessContext`,
  `hasPermission`, `requirePermission`, `BusinessAccessError`.
- `src/server/business/context.ts::resolveBusinessContext(actor, businessId)`:
  admins get `Set(["*"])`, staff permissions are read from
  `roles → role → permissions → permission.permissionKey`; owner is a system role
  named `owner`.
- Guards: `requireStudioAccess(permission, path)` and
  `requireBusinessAccess(businessId, permission, path)`;
  `src/features/b2b/access.ts`, `src/features/b2b/page-access.ts`.
- 35 registered permission keys across migrations and `scripts/seed.mjs`. The only
  delivery-related key is `delivery.request.create`; dispatch is admin-only.
- `UserRole` is only `CUSTOMER | VENDOR | ADMIN`. A courier is a normal platform user
  (seed uses `CUSTOMER`), linked 1:1 via `DeliveryAgent.userId`. There is no driver
  role and no company ownership field on `User`.

### 2.3 Reusable platform infrastructure

- Money: `src/features/catalog/money.ts` (`parseMoneyToCents`, `decimalToCents`,
  `formatMoney`); all amounts are integer cents in code and `Decimal(12,2)` + explicit
  `currency` in PostgreSQL. No floating point.
- Audit: `recordAuditEvent(tx, { actorId, action, targetType, targetId, metadata })`
  with the `AuditAction` enum.
- Transactional outbox: `src/features/outbox/service.ts` — `appendOutboxEvent` inside
  the producer transaction, `registerOutboxHandler`, capped-retry dispatch. No
  delivery events are registered today.
- Feature flags: `src/features/flags/service.ts::isFeatureEnabled(key)`, default
  false for unknown keys; used to hide incomplete slices.
- Zod at every boundary, `FormState` for server actions, `FixedWindowRateLimiter`,
  idempotency through unique keys (`externalRef`, `entryKey`, `reference`,
  webhook delivery ID).
- Tests: `tests/unit/logistics-dispatch.test.ts`, `logistics-pricing.test.ts`,
  `business-permissions.test.ts`, `studio-access.test.ts`, `phase7-ecosystem.test.ts`;
  PostgreSQL integration suites run when `TEST_DATABASE_URL` is set.

### 2.4 Gaps that matter for this domain

- No organization owns a fleet; `DeliveryVehicle` is 1:1 with an agent.
- No company/client/contract concepts, no company-scoped dispatch or permissions.
- No delivery outbox events, no LBN feature flag.
- No API versioning anywhere in the repo.
- No rate limiting on delivery endpoints.
- No reassignment action exists yet, although `DeliveryAssignment.releasedAt`
  anticipates it.

---

## 3. Architecture decisions

### 3.1 First-class company, shared permission vocabulary

`logistics_companies` is a first-class table, not a subtype of `delivery_agents`.
It carries its own verification, plan and settings. To avoid inventing a second
permission system, the company uses:

- a **new** `logistics_company_members` and `logistics_company_roles` table for
  company-scoped membership and roles; and
- the **existing global `Permission` table** for the permission keys themselves.

A new `src/server/logistics/context.ts::resolveLogisticsContext(actor, companyId)`
mirrors `resolveBusinessContext`: it re-checks membership, status and role permissions
from PostgreSQL on every request, returns `permissions: Set<string>`, and grants
admins `Set(["*"])`. `hasPermission` from `src/server/business/permissions.ts` is
reused unchanged.

Rationale: the spec asks for company-specific roles; the platform already has a
proven tenant/permission resolver. Reusing the vocabulary and the pure helper while
keeping company roles separate gives tenant isolation without duplicating 35
permission keys or weakening the existing business model.

**Open decision:** optionally link `logistics_companies.businessId` to a `Business`
record so a company can use the existing Business OS and verification. Proposal: keep
the column nullable and do not require it for L1; revisit after company identity is
proven. Do not couple the two organization models by default.

### 3.2 Driver identity is independent of company ownership

`driver_profiles` is keyed by `userId` (nullable for drivers without a platform
account). Ownership is expressed **only** through `driver_company_memberships`
(company + driver + status + roles). There will be no exclusive
`logistics_company_id` on the global driver identity or on `User`.

This permits a driver to change companies, hold multiple authorized memberships, be
independent, have one relationship suspended without losing their account, and keep
historical delivery attribution.

Migration path for existing data: `driver_profiles.deliveryAgentId` links to the
existing `DeliveryAgent`. Dispatch resolves a company driver through membership,
falling back to the existing `DeliveryAgent` path for platform-originated jobs.
`DeliveryAgent` is not deleted and its state machine is not duplicated.

### 3.3 One delivery engine

Company jobs are rows in the existing `DeliveryRequest` / `DeliveryJob` tables with a
nullable `companyId` and optional `contractId`. The same forward-only
`JOB_TRANSITIONS`, `canActorTransition`, optimistic concurrency, OTP, proof, GPS
pings, tracking endpoint and `DeliveryStatusHistory` continue to apply. There will be
**no second assignment system**. `DeliveryAssignment.releasedAt` is used for
reassignment instead of deleting rows.

`DeliveryVehicleType` gains `TRUCK` via a migration; company vehicles live in
`logistics_vehicles`, while existing 1:1 `delivery_vehicles` rows remain for legacy
agents.

### 3.4 Three separate financial relationships

1. Platform ↔ logistics company (fees, settlements, rewards).
2. Logistics company ↔ merchant client (invoices, contracts).
3. Logistics company ↔ driver (compensation, earnings, payouts).

Company invoices, earnings, expenses and payouts get their own tables and are never
posted into the platform `CommissionLedger` or `Payout` tables. Platform fees use
configurable basis points with a documented default; no tax, insurance or employment
policy is invented. No payout is marked successful without verified payment
confirmation, and the platform does not hold or disburse third-party money unless an
appropriately authorized payment structure exists.

### 3.5 Two commercial modes

- **Platform-originated:** the platform creates the request; dispatch ranks eligible
  verified companies by coverage, capacity, vehicle, reliability and price. The
  company accepts or declines; never auto-award to an unverified company.
- **Company-originated:** the company registers its own merchant client and creates
  the request. The platform charges an agreed software/transaction/network fee, not
  the same acquisition cost as a platform-originated customer.

### 3.6 Rollout safety

A new flag `phase9.logisticsNetwork` defaults to disabled. Company routes and APIs
return "coming soon" until an administrator enables it. All mutations are guarded by
`requireLogisticsAccess(permission, companyId)`, Zod-validated, audited, and published
through the outbox in the producer transaction.

---

## 4. Data model: requested tables mapped to decisions

Every new table carries `companyId` (or a path to it) so tenant ownership is explicit;
FKs and unique constraints enforce it where possible.

| Requested table | Decision | Notes |
|---|---|---|
| `logistics_companies` | NEW | Profile, verification, plan, settings, nullable `businessId` |
| `logistics_company_members` | NEW | `companyId + userId` unique, status, invitedBy |
| `logistics_company_roles` | NEW | `companyId + name` unique, `isSystem`; permissions via existing global `Permission` |
| `logistics_branches` | NEW | Company locations, coordinates, operating hours |
| `logistics_service_areas` | NEW | Company coverage zones; coexists with existing `AgentServiceArea` used by the scorer |
| `logistics_fleets` | NEW | Grouping of vehicles by branch |
| `logistics_vehicles` | NEW | Type incl. `TRUCK`, ownership/lease, capacity, status, insurance/inspection dates |
| `vehicle_documents` | NEW | Registration, insurance, inspection; storage keys and expiry |
| `vehicle_maintenance` | NEW | Service/repair history and cost |
| `driver_profiles` | NEW | Nullable `userId` and `deliveryAgentId`; license, status |
| `driver_company_memberships` | NEW | Authoritative driver↔company relation; status + roles |
| `driver_employment_records` | NEW | Employee/contractor terms and dates |
| `driver_schedules` | NEW | Shifts and availability windows |
| `driver_vehicle_assignments` | NEW | Time-bounded assignment; closed on reassignment |
| `logistics_clients` | NEW | Merchant identity independent of marketplace vendor; may relate to many companies |
| `logistics_client_contacts` | NEW | Named contacts per client |
| `logistics_contracts` | NEW | Type, status, dates, version and parent for history |
| `logistics_contract_pricing` | NEW | Mode (per-delivery/monthly/volume/dedicated/geographic/hybrid), currency, amounts, bps |
| `logistics_contract_slas` | NEW | Metric, target, window, penalty rule |
| `logistics_contract_deliveries` | NEW | Links contract to existing `DeliveryJob`; used for allocation and billing |
| `logistics_invoices` | NEW | Unique number, client, contract, period, status, totals |
| `logistics_invoice_items` | NEW | Invoice lines referencing contract deliveries |
| `logistics_expenses` | NEW | Company/vehicle operational and fuel costs |
| `driver_compensation_rules` | NEW | Fixed, per-delivery, percentage, daily or hybrid; configurable |
| `driver_earnings` | NEW | Per-job, keyed by membership; separate from `agent_earnings` |
| `driver_payouts` | NEW | Company-side payment records; separate from platform `Payout` |
| `logistics_settlements` | NEW | Company period settlement: revenue, platform fee, net |
| `logistics_referrals` | NEW | Unique code, link/QR payload, attribution state |
| `partner_rewards` | NEW | Eligible reward definitions and amounts |
| `partner_reward_transactions` | NEW | Reward history with idempotency key and status |
| `logistics_performance_metrics` | NEW | Snapshot KPIs: completion, on-time, utilization, profitability |

**Modified existing tables:** nullable `companyId` and `contractId` on
`DeliveryRequest` and `DeliveryJob`; `TRUCK` added to `DeliveryVehicleType`; new
`AuditAction` values and outbox event types. No existing column is removed or
repurposed.

---

## 5. State machines

- Contracts: `DRAFT → PROPOSED → ACTIVE → (SUSPENDED → ACTIVE) → EXPIRED | TERMINATED`.
- Referrals: `GENERATED → REGISTERED → VERIFIED → ACTIVATED → QUALIFIED | REJECTED`.
- Rewards: `PENDING → ELIGIBLE → PAID | INELIGIBLE`.
- Invoices: `DRAFT → ISSUED → PAID | OVERDUE | CANCELLED`.
- Deliveries: **unchanged** — existing `DeliveryJobStatus`.
- Driver membership: `ACTIVE → SUSPENDED → ACTIVE | ENDED`.

All transitions are forward-only where the business allows it, validated in pure
modules (like `src/features/logistics/status.ts`) and unit-tested.

---

## 6. Permission hierarchy

New keys, using the existing `Permission` table and rolemapping:

`logistics.company.read`, `logistics.company.update`, `logistics.fleet.manage`,
`logistics.driver.manage`, `logistics.driver.view`, `logistics.dispatch.manage`,
`logistics.client.manage`, `logistics.contract.manage`, `logistics.finance.read`,
`logistics.finance.approve`, `logistics.referral.manage`.

Default system roles: Owner (`*`), Operations manager, Fleet manager, Dispatch
officer, Finance manager, HR manager, Sales representative, Accountant, Driver
(limited to assigned deliveries and own earnings). Custom roles are supported by the
existing role/permission tables.

High-risk actions require an approval threshold: a finance member may create a
payout but a different member with `logistics.finance.approve` must confirm it above a
configurable amount. No client-supplied role, company ID, price, status or total is
trusted.

---

## 7. API and UI surface

New versioned namespace: `/api/v1/logistics/...` with
`companies`, `vehicles`, `drivers`, `clients`, `contracts`, `jobs`, `dispatch`,
`invoices`, `expenses`, `earnings`, `settlements`, `referrals`, `rewards`. This is the
first versioned API namespace in the repo; all other conventions (session auth,
tenant isolation from the session, Zod, `no-store`, `connection()`, unique-key
idempotency, rate limiting) are reused rather than reimplemented.

Permission-aware UI routes:

- Platform admin: `/admin/logistics` (companies, verification, dispatch oversight,
  analytics, disputes).
- Company: `/logistics/[companyId]` dashboard plus `fleet`, `drivers`, `clients`,
  `contracts`, `dispatch`, `finance`, `referrals`.
- Driver: `/driver` assignments, availability and earnings.
- Merchant client: `/logistics/clients/[clientId]` requests, tracking, statements.

All company/driver/client reads resolve the tenant from the session, never from a
query parameter.

---

## 8. Delivery sequence (proposed Phase 9 with L-slices)

| Slice | Scope | Gate |
|---|---|---|
| **L1** | Company registration, verification, company members/roles, `resolveLogisticsContext`, permissions, feature flag | Two companies cannot read each other's data; staff without a permission are denied |
| **L2** | Dashboard shell, company profile, branches, settings, activity history | Owner and staff see only their company; approvals audited |
| **L3** | Fleet, vehicles, documents, maintenance, driver profiles, memberships, schedules, vehicle assignments | Driver can move between companies; one company cannot assign another's vehicle |
| **L4** | Merchant clients and contacts, independent of marketplace vendor | A client can work with several companies; no vendor account required |
| **L5** | Contracts, pricing, SLAs, versions, acceptance, suspension/termination, performance | Contract pricing computed from stored terms; history preserved |
| **L6** | Company dispatch and delivery management, contract-linked deliveries, reassignment, OTP/proof/tracking reuse | No double assignment; existing job state machine unchanged |
| **L7** | Invoices, expenses, driver compensation rules, earnings, payouts, settlements | Company ledger reconciles; no payout before confirmed payment |
| **L8** | Platform dispatch marketplace and company eligibility | Unverified companies never receive offers; acceptance/rejection recorded |
| **L9** | Referrals, attribution and reward eligibility engine | No reward without verified merchant + qualifying delivery; self-referral/duplicate rejected |
| **L10** | External e-commerce APIs and webhooks | Idempotent, signed, rate-limited |
| **L11** | Fleet sharing and parcel hubs (later) | Explicit consent, insurance and accountability recorded |
| **L12** | AI logistics optimization (later) | Deterministic baseline preserved as fallback |

**Explicit dependency:** L9 must not start before L4 (client identity) and L5
(contract activation) are complete. Dispatch marketplace (L8) depends on L3 and L5.

Recommended first implementation: **L1 only**, then review before L2.

---

## 9. Test strategy

Pure unit tests for every state machine, pricing/compensation calculation and reward
eligibility rule. PostgreSQL integration tests (`TEST_DATABASE_URL`) for tenant
isolation, driver membership changes, reassignment races, duplicate invoice
prevention, ledger separation, payment callbacks and reward fraud. End-to-end
coverage of the seven acceptance scenarios from the brief:

A. company registers, verifies, adds five motorcycles and five drivers;
B. company registers a shop as a client and signs a monthly contract;
C. shop submits a delivery for a purchase made outside the marketplace;
D. driver is assigned, collects, completes with OTP and proof;
E. invoice, company revenue, platform fee and driver earnings are produced;
F. company refers another merchant and receives an eligible reward after qualifying
   activity;
G. platform independently offers a marketplace delivery to an eligible company.

All scenarios must assert real database state transitions, not mocked success.

---

## 10. Risks and unresolved policy

- Commission, tax, insurance, employment and liability rules remain unresolved in
  `docs/01-product-vision.md`. Use explicitly labelled configurable defaults; do not
  invent policy.
- Paying rewards requires verified payments and an authorized payment structure;
  until then rewards are recorded as eligibility/points, not cash.
- Adding `companyId` to busy delivery tables needs index planning and a backward-
  compatible rollout; existing platform jobs remain company-less.
- Tenant isolation must be tested at the data layer, not just in the UI.
- The driver/company relationship has legal and tax implications; employment records
  are informational, not legal advice.
- Fleet sharing/subcontracting requires consent, insurance and a single accountable
  company per delivery.

---

## 11. Acceptance for this proposal

- [x] Proposal reviewed and first slice (L1) approved.
- [x] Phase 9 entry added to the roadmap.
- [x] No application code was changed before the proposal was written.
- [x] L1 implemented: migration `20261124120000_phase9_logistics_l1`, company
      identity, memberships, roles, tenant resolver, 11 permission keys, feature flag,
      `/logistics` and `/admin/logistics` pages, and unit tests.
- [x] L2 implemented: profile editing, branches, settings and an audit-derived
      activity feed, with validation unit tests.
- [ ] L3–L12 remain to be approved and implemented one slice at a time.
