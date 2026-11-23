# Implementation Roadmap

> Phase 0 audit — updated for the Phase 6 account security slice.

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

## Phase 5 — B2B Network ✅ IMPLEMENTED

Delivered as database-backed features (not a prototype):

- `wholesale_listings`, `wholesale_price_tiers`, `rfqs`, `rfq_items`,
  `supplier_quotations`, `quotation_items`, `business_purchase_orders`,
  `business_purchase_order_items`, `business_invoices`, `business_invoice_items`
  — all applied in migrations `20261120170000_phase5_b2b` and
  `20261120170100_phase5_b2b_permissions`.
- Buyer workspace at `/b2b`: catalog browsing with volume tiers, RFQ creation,
  quotation review/acceptance, purchase orders and invoice payment.
- Seller workspace under `/vendor`: wholesale listing management, incoming RFQs,
  supplier quotations, order fulfilment status, and invoice issuance.
- Business-scoped permissions (`wholesale.read`, `wholesale.manage`,
  `b2b.rfq.create`, `b2b.purchase_order.create`, `b2b.invoice.read`) with
  server-side checks on every read and mutation.
- Forward-only document state machines for RFQs, quotations, purchase orders and
  invoices, with audit events recorded in the same transaction.
- Decimal-safe tier pricing and total calculation, plus a demo RFQ → quotation →
  purchase order → invoice chain in `scripts/seed.mjs`.

### New tables
`wholesale_listings`, `wholesale_price_tiers`, `rfqs`, `rfq_items`, `supplier_quotations`, `quotation_items`, `business_purchase_orders`, `business_purchase_order_items`, `business_invoices`, `business_invoice_items`

**Deliverable**: Retailers search wholesale stock, request quotes, place bulk orders, and settle invoices.

---

## Phase 6 — Growth, Intelligence, and Trust Conversion (IN PROGRESS)

**Goal**: Real CRM, loyalty, chat, and AI — convert remaining prototypes.

### Delivered: account-backed messaging and saved objects

- `chats` and `chat_messages` tables, applied in migration
  `20261121090000_phase6_messaging`, with one thread per buyer/studio pair,
  recipient read receipts and audit events for thread creation and messages.
- Buyer inbox at `/messages` and `/messages/[chatId]`; studio inbox at
  `/vendor/messages` and `/vendor/messages/[chatId]`. Studio replies are guarded
  by the new `messaging.reply` permission and business-scoped studio access.
- Product and studio "Message studio" buttons now open a real database thread
  instead of seeding the experience-centre localStorage simulation.
- Experience-centre inbox and saved panels now read account-backed data. The
  wishlist uses the existing `WishlistItem` table and `toggleWishlistAction`;
  price-drop and restock notifications remain a device-local aid.
- Three messaging unit tests plus a seeded demo conversation between
  `customer@supplyhub.test` and Atelier Nord.

### Delivered: CRM and loyalty

- `customers`, `loyalty_accounts`, and `loyalty_transactions` tables, applied in
  migration `20261121093000_phase6_crm_loyalty`, plus `crm.read` and
  `crm.manage` studio permissions.
- Studio CRM at `/vendor/customers`: one record per buyer, with order/spend
  aggregates derived from real `VendorOrder` rows and editable private notes and
  segments. Records are created automatically when an order is placed.
- Buyer loyalty at `/account/loyalty`: points balance, lifetime tier progress,
  transaction history, and single-use checkout coupon redemption (500 points →
  5,000 TZS). Points are awarded exactly once when an order reaches delivered.
- Three loyalty calculation tests plus seeded demo CRM records and a Silver-tier
  loyalty ledger for `customer@supplyhub.test`.

### Delivered: subscriptions

- `subscription_plans`, `business_subscriptions`, and `subscription_invoices`, applied in
  migration `20261121100000_phase6_subscriptions`, with a new `subscription.manage`
  business permission and subscription audit events.
- Admin plan management at `/admin/subscriptions` creates and edits active, draft,
  or archived plans with monthly pricing, seat limits, and feature lists.
- Business subscription page at `/business/[id]/subscription` lets authorized
  members choose a plan, set seats, cancel, and mark invoices paid. Plan cards
  show monthly pricing per billable seat above the included allocation.
- Subscription state transitions and billable-seat calculations are covered by
  three unit tests, and the seed data includes three plans plus an active Growth
  subscription and issued invoice for Atelier Nord Studio.

### Delivered: account security

- TOTP 2FA is now real: secrets are AES-256-GCM encrypted at rest with a key
  derived from the server-only `AUTH_SECRET`, and sign-in accepts either a current
  authenticator code or a single-use backup code.
- `backup_codes` and `phone_verifications` tables (migrations
  `20261123120000_phase6_account_security` and
  `20261123121500_phase6_phone_verification_consumption`) store only hashes.
  TOTP replay is blocked by `two_factor_last_step`; backup codes and phone codes
  are consumed once, and phone verification is rate limited and audited.
- The account security page at `/account/security` replaces the experience-centre
  security simulation. Login-alert history remains a device-local aid; no real
  event stream is recorded for it.
- SMS delivery is provider-neutral: development writes codes to `.local/sms-outbox`,
  while production reports `phone.delivery_unconfigured` rather than inventing a
  provider. Choosing an SMS provider remains unresolved business policy.
- Eight unit tests cover RFC 6238 vectors, replay blocking, backup-code hashing,
  and phone-code binding.

### Remaining Phase 6 work

- `business_ai_insights`, `ai_recommendation_history`
- Choose and document an SMS provider before enabling phone verification in production
- Replace the device-local login-alert simulation with real sign-in events

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
