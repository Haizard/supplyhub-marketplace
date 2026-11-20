# Implementation Roadmap

> Phase 0 audit — updated for Phase 4 logistics implementation.

## What is Already Done (confirmed after full re-inspection)

### Fully implemented and database-backed
- ✅ Auth (sign-up, sign-in, email verify, password reset, session invalidation)
- ✅ Vendor application, approval, rejection, appeal, suspension workflow
- ✅ Product catalogue with instant self-publishing and admin moderation
- ✅ Hierarchical categories
- ✅ Multi-vendor cart and checkout with transactional stock reservation
- ✅ Delivery choice (pickup/delivery) with haversine fee calculation
- ✅ Payment processing via LynxPay (M-Pesa, Tigo, Airtel) with idempotency and webhook handling
- ✅ Commission ledger and vendor payout system
- ✅ Admin panel (vendors, products, users, orders, payments, payouts, audit log, CSV exports)
- ✅ Image storage (local + S3)
- ✅ Dual-mode database: local Postgres + Supabase hosted
- ✅ New arrivals (day/week/month) on home page
- ✅ Search autocomplete with typo correction (`/api/search-suggest`)
- ✅ Five-language i18n (en, sw, ar, zh, fr) — cookie-based, no URL changes
- ✅ Verified studio badge (DB-enforced)
- ✅ Mobile bottom navigation (buyer + seller)
- ✅ PWA (manifest, service worker, offline page)
- ✅ Phase 4 delivery network: verified couriers, dispatch scoring, DB-backed job lifecycle,
  OTP hand-over, photo/signature proof, courier location pings, earnings/commissions,
  external delivery request API (`/api/delivery/requests`), live tracking (`/delivery/track/[jobId]`)

### Prototype only (UI exists, no database backing)
- ⚠️ The original `/delivery-live` map demo (kept for illustration; real tracking is now DB-backed at `/delivery/request` and `/delivery/track/[jobId]`)
- ⚠️ Buyer experience centre (wishlist, price watch, chat, escrow, reviews, security)
- ⚠️ Sandbox payment simulation

---

## Immediate Fixes Before Phase 1 (updated list)

These must be resolved before new feature development starts:

1. **Instant publishing without moderation** — add an automated check or post-publish review queue
2. **Experience centre demo labelling** — every panel must clearly state it is a prototype, not live functionality
3. **Search suggest rate limiting + caching** — prevents DB hammering on every keystroke
4. **Add `CHECK (stock >= 0)` on `products`** — prevents negative stock from bugs
5. **Add CSP / security headers** to `next.config.ts`
6. **Define `resolveBusinessContext` interface** — needed before Phase 1 work begins

---

## Phase 1 — Business Identity and Multi-Business Architecture

**Goal**: Replace 1:1 user↔vendor with a multi-business, multi-member, role-permission model. All subsequent phases depend on this.

### New tables
`businesses`, `business_members`, `business_branches`, `business_roles`, `permissions`, `role_permissions`, `member_roles`, `business_documents`, `business_settings`

### Key changes
- Add `business_id` (nullable) to `vendors`; backfill for all existing vendors
- Extend JWT session with `businessId` and permission set
- Create `resolveBusinessContext(userId, businessId)` utility
- Update vendor studio to use business context
- Business registration, branch management, member invitation, role assignment APIs

**Deliverable**: Vendors can invite employees; employees see only their business's data.

---

## Phase 2 — Business Operating System

**Goal**: POS, inventory, finance — give vendors a reason to use the platform daily.

### New tables
`warehouses`, `inventory_balances`, `pos_registers`, `pos_sessions`, `sales`, `sale_items`, `sale_payments`, `expenses`

### Key changes
- POS: product scan, cart, payment recording, receipt, cash register open/close
- Multi-warehouse inventory balances
- Expense recording and daily cash report
- Vendor dashboard: revenue, profit, stock health

**Deliverable**: Vendor can process physical sales, see daily revenue, all updating same inventory as online orders.

---

## Phase 3 — Commerce Integration + Prototype Conversion

**Goal**: Strengthen the marketplace and convert the best prototypes to real features.

### New tables
`product_variants`, `order_status_history`, `returns`, `return_items`, `promotions`, `coupons`, `wishlists` (real), `product_reviews` (real), `shipments`

### Key changes
- Product variants (size/colour/SKU)
- Real persistent wishlists (replace localStorage)
- Real product reviews (verified-purchase gate)
- Customer-initiated return flow
- Coupon / discount codes at checkout
- Order status history (append-only)

**Deliverable**: Richer product listings, real reviews, real wishlists, promotions, return flow.

---

## Phase 4 — Shared Logistics Network ✅ IMPLEMENTED

Delivered as database-backed features (not a prototype):
- `delivery_agents`, `delivery_vehicles`, `agent_documents`, `agent_service_areas`,
  `delivery_requests`, `delivery_jobs`, `delivery_assignments`, `delivery_status_history`,
  `delivery_locations`, `delivery_proofs`, `agent_earnings`, `delivery_commissions`,
  `delivery_pricing_rules` — all applied in migration `20261120154000_phase4_logistics`.
- Agent registration, document review and approval by admins (`/courier`, `/admin/delivery`).
- Deterministic dispatch scorer (distance, rating, experience, service area, availability).
- Forward-only job state machine with append-only history and optimistic concurrency.
- Six-digit OTP hand-over with expiry, plus photo/signature proof records.
- Real-time tracking via courier GPS pings (`/api/courier/jobs/[jobId]/location`) and
  an authorized polling endpoint (`/api/delivery/jobs/[jobId]/track`).
- External delivery request API with session auth and idempotency (`/api/delivery/requests`).
- Immutable agent earnings and platform commission rows, with admin payment reconciliation.
- Configurable distance pricing rule (documented default; business policy still unresolved).

### New tables
`delivery_agents`, `delivery_vehicles`, `agent_documents`, `agent_service_areas`, `delivery_requests`, `delivery_jobs`, `delivery_assignments`, `delivery_status_history`, `delivery_locations`, `delivery_pricing_rules`, `delivery_proofs`, `agent_earnings`, `delivery_commissions`

### Key changes
- Agent registration and verification
- Dispatch engine with scoring (distance, reliability, capacity)
- Real delivery lifecycle state machine (database-backed)
- OTP-confirmed delivery + photo proof
- Real-time tracking backend (replace client-side simulation)
- External delivery request API (businesses use delivery independently)
- Agent earnings and payouts

**Note**: The TypeScript types in `src/components/delivery/model.ts` are the schema specification — use them directly when designing these tables.

**Deliverable**: Orders assigned to real agents; live tracking backed by DB; external businesses use delivery.

---

## Phase 5 — B2B Network

### New tables
`wholesale_listings`, `rfqs`, `rfq_items`, `supplier_quotations`, `business_purchase_orders`, `business_purchase_order_items`, `business_invoices`

**Deliverable**: Retailers search wholesale stock, request quotes, place bulk orders.

---

## Phase 6 — Growth, Intelligence, and Trust Conversion

**Goal**: Real CRM, loyalty, chat, and AI — convert remaining prototypes.

### New tables / conversions
- `customers` (vendor-scoped CRM), `loyalty_accounts`, `loyalty_transactions`
- `chats`, `chat_messages` (replace experience centre simulation)
- `subscription_plans`, `business_subscriptions`, `subscription_invoices`
- `business_ai_insights`, `ai_recommendation_history`
- Real security features (2FA via TOTP, phone OTP) — replace simulation

**Deliverable**: Real chat, real loyalty, real 2FA, AI business insights, subscription revenue.

---

## Phase 7 — Ecosystem Expansion

- Services marketplace (bookings)
- Group / community buying
- Outbox-based domain event publishing
- Feature flags
- Regional logistics network

---

## Dependency Graph

```
Phase 0 (Audit + Setup)              ← DONE
    ↓
Immediate Fixes (6 items)            ← DO FIRST
    ↓
Phase 1 (Business Identity)          ← REQUIRED BEFORE ALL OTHERS
    ↓
Phase 2 (Business OS)                ← Requires Phase 1
Phase 3 (Commerce + Prototypes)      ← Requires Phase 1; can overlap with Phase 2
    ↓
Phase 4 (Real Logistics)             ← Requires Phase 1 + Phase 3
    ↓
Phase 5 (B2B)                        ← Requires Phase 1 + Phase 4
    ↓
Phase 6 (Growth + AI + Trust)        ← Requires Phase 1, 2, 3; CRM can start earlier
    ↓
Phase 7 (Ecosystem)                  ← Requires all earlier phases
```
