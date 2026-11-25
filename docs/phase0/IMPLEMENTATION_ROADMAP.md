# Implementation Roadmap

> Phase 0 audit — Phase 7 ecosystem expansion delivered: services marketplace, group buying, and regional logistics behind feature flags.

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
- ⚠️ Buyer experience centre (wishlist, price watch, chat, escrow, reviews; security now links to the account-backed page)
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

**Note**: The original `src/components/delivery` map simulation has been retired from the UI. `/delivery-live` now resolves to the database-backed request, courier, or admin delivery view, and tracking links go to `/delivery/track/[jobId]`.

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
  security simulation, which now links to the real account page. Successful
  credentials sign-ins are persisted in `sign_in_events` with a request-derived
  device, deployment geo headers, a coarse IP, the sign-in method, and a
  new-device flag. A `SIGN_IN_SUCCEEDED` audit event is written in the same
  transaction. Audit failure never blocks a valid sign-in.
- Phone verification is explicitly deferred. The provider-neutral schema and
  service remain, but the UI no longer offers phone verification and the server
  actions return a disabled message instead of sending or consuming a code.
- Eleven unit tests cover RFC 6238 vectors, replay blocking, backup-code hashing,
  phone-code binding, and sign-in request detail parsing.

### Delivered: AI insights and recommendations

- `business_ai_insights` and `ai_recommendation_history`, applied in migration
  `20261123124500_phase6_ai_insights`, with a new `insights.read` business permission
  and audit events for generation and dismissal.
- Business insights at `/business/[id]/insights` are deterministic rule snapshots
  under version `configurable-rules-v1`. They are built from real sales, vendor
  orders, product stock, warehouse balances, and CRM customer records. No external
  model or provider is called. Gemini is the selected provider direction, but no
  key is configured in this workspace, so a live-model slice has not been wired.
- Buyer recommendations at `/recommendations` use orders, wishlists, catalog
  popularity, and stock. Scores are integer basis points persisted as decimals and
  every suggestion can be refreshed or dismissed.
- Four unit tests cover threshold generation, stable fallback output, wishlist
  affinity scoring, and deterministic ranking.

### Remaining Phase 6 work

- The Gemini live-model slice is now wired behind `configurable-rules-v1`: it is
  opt-in via `AI_INSIGHTS_PROVIDER=gemini` plus `GEMINI_API_KEY`, sends only aggregate
  signals, validates responses, and falls back to deterministic rules on any failure.
  No key is configured in this workspace, so the shipped default remains offline.
- Choose an SMS provider before re-enabling phone verification; it remains
  intentionally disabled for now

**Deliverable**: Real chat, real loyalty, real 2FA, persisted sign-in history, real
delivery tracking entry points, AI business insights, and subscription revenue.

---

## Phase 7 — Ecosystem Expansion (IMPLEMENTED)

**Goal**: Add ecosystem capabilities on explicit rollout switches and publish domain
events through a durable outbox rather than ad-hoc side effects.

### Delivered: foundations

- Migration `20261123143000_phase7_foundations` adds `feature_flags`, `outbox_events`,
  the `OutboxEventStatus` enum, and audit actions for flag and outbox changes.
- `/admin/feature-flags` creates and toggles stable keys. `isFeatureEnabled(key)`
  is server-only and defaults to false for unknown keys, so incomplete features
  stay hidden.
- Flag mutations append an outbox event and an audit event in the same database
  transaction, so a flag change cannot be recorded without its event.
- `/admin/outbox` lists recent events and exposes a dispatcher. The dispatcher
  claims `PENDING` rows, calls registered in-process handlers, marks successes
  `PUBLISHED`, and retries failures with capped exponential backoff until
  `MAX_OUTBOX_ATTEMPTS` is reached. It also has an admin-only POST endpoint at
  `/api/admin/outbox/dispatch` for a future scheduler.
- Seed data creates disabled flags for `phase7.servicesMarketplace`,
  `phase7.groupBuying`, and `phase7.regionalLogistics`.

### Delivered: services marketplace (behind `phase7.servicesMarketplace`)

- Migration `20261123160000_phase7_ecosystem` adds `service_listings` and
  `service_bookings` tables with `ServiceListingStatus` and
  `ServiceBookingStatus` enums.
- Vendors can create, edit, and archive service listings at `/vendor/services`
  with title, description, category, price, duration, and location. Listings
  publish as ACTIVE immediately (consistent with product behaviour).
- Buyers can browse active service listings at `/services` and book a service
  at `/services/[listingId]` with a date/time selection. The service price is
  snapshotted at booking time.
- Vendors manage bookings at `/vendor/services/bookings` with forward-only
  status transitions: REQUESTED → CONFIRMED → IN_PROGRESS → COMPLETED (or
  CANCELLED / NO_SHOW at appropriate points).
- All mutations are guarded by `requireStudioAccess("services.manage")`,
  validated with Zod, recorded as audit events, and published via the outbox.

### Delivered: group / community buying (behind `phase7.groupBuying`)

- `group_buy_campaigns`, `group_buy_tiers`, and `group_buy_participations`
  tables with the `GroupBuyStatus` enum.
- Vendors create campaigns at `/vendor/group-buy` with base price, target
  quantity, start/end dates, and progressive discount tiers. Campaigns
  transition DRAFT → ACTIVE → FUNDED → COMPLETED (or EXPIRED / CANCELLED).
- Buyers browse active campaigns at `/group-buy` and join at
  `/group-buy/[campaignId]`. The reserved price is resolved from the tier
  matching cumulative participation. Unique constraint prevents double-join.
- When total participation reaches the target quantity, the campaign
  auto-transitions to FUNDED with an audit event and outbox event.
- All mutations are guarded by `requireStudioAccess("groupbuy.manage")` or
  `requireActor`, validated with Zod, and published via the outbox.

### Delivered: regional logistics network (behind `phase7.regionalLogistics`)

- `regional_corridors` and `corridor_stops` tables with the `CorridorStatus`
  enum, connecting business branches with base/per-km fees and estimated
  distance/time.
- Admins manage corridors at `/admin/corridors` with origin/destination branch
  selection, intermediate stops, and pricing. Corridors transition
  DRAFT → ACTIVE ↔ INACTIVE.
- Buyers can browse active corridors at `/corridors` with origin → destination,
  stops, estimated distance/time, and base fee.
- All mutations are guarded by `requireAdmin()`, validated with Zod, and
  published via the outbox.

### Delivered: outbox domain handlers

- Registered handlers for all Phase 7 event types:
  `service_listing.created`, `service_booking.requested/confirmed/cancelled/completed`,
  `group_buy.campaign_created/updated/joined/left/funded`,
  `regional_corridor.created/updated/activated/deactivated`.
- Each handler logs structured information via the platform logger. Richer
  domain consumers can replace these as needed.

### Seed data

- All three feature flags are enabled in the seed script for demo exploration.
- Demo service listings (tailoring consultation, furniture restoration) and a
  demo booking.
- Demo group buy campaign (Linen Shirt Community Buy) with three discount tiers
  and a demo participation.
- Demo regional corridor (Dar es Salaam ↔ Arusha) connecting business branches.

### Unit tests

- `tests/unit/phase7-ecosystem.test.ts` covers all three state machines:
  booking transitions, campaign transitions, and corridor transitions.

---

## Phase 8 — Trust, Verification and Operations (IMPLEMENTED)

**Goal**: Close the remaining operational trust gaps so administrators can verify
businesses, resolve buyer disputes, see platform-wide metrics from defined sources,
and reconcile payments automatically instead of by hand.

### Delivered: business verification (KYC)

- `business_verification_documents` and `business_verification_reviews` tables with
  `VerificationDocumentType` and `VerificationReviewStatus` enums, applied in migration
  `20261123180000_phase8_trust`.
- Businesses submit document type, reference and storage key from
  `/business/[id]/verification`; admins approve or reject each document with a reason at
  `/admin/verification`. Approving the last required document moves the business to
  `verified`, rejecting moves it to `rejected`.
- Every submission and review is guarded, Zod-validated, audited and published through
  the outbox in the same transaction.

### Delivered: dispute resolution centre

- `disputes` and `dispute_messages` tables with the `DisputeStatus` enum.
- Buyers open a dispute against one of their vendor orders at `/account/disputes` and
  exchange messages at `/account/disputes/[disputeId]`.
- Administrators triage at `/admin/disputes` and resolve at `/admin/disputes/[disputeId]`;
  forward-only state machine OPEN → UNDER_REVIEW → RESOLVED | REJECTED, with a required
  resolution note. All reads and mutations are actor/admin guarded and audited.

### Delivered: platform analytics

- Read-only `/admin/analytics` aggregates GMV, paid orders, active studios, commission,
  refunds, payouts, new customers and dispute load directly from existing tables. Every
  metric has a named source so the dashboard cannot disagree with the ledger.

### Delivered: automated payment reconciliation

- `reconciliation_runs` and `reconciliation_findings` tables. A server-only service
  compares each payment attempt with the ledger and flags missing, short or excess
  entries; it is idempotent per run and records findings in one transaction.
- Admin page `/admin/reconciliation` with a "Run now" action and a cron-friendly
  `POST /api/admin/reconciliation` endpoint guarded by `requireAdmin()`.

---

## Phase 9 — Logistics Business Network (IN PROGRESS — L1 delivered)

**Goal**: Promote logistics companies to first-class commercial partners that can run
their own fleet, drivers, merchant clients, contracts and finances through the platform,
while keeping one shared delivery engine and one permission vocabulary.

This phase is deliberately split into L1–L12 slices. The full repository-first
technical proposal, data-model mapping, ownership decisions, permission hierarchy and
test strategy are in
[docs/phase0/LOGISTICS_BUSINESS_NETWORK_PROPOSAL.md](LOGISTICS_BUSINESS_NETWORK_PROPOSAL.md).

- **L1 — DELIVERED** Company registration, verification submission and admin review,
  members/roles, `resolveLogisticsContext`, eleven company-scoped permission keys and
  the `phase9.logisticsNetwork` flag (off by default). Pages at `/logistics` and
  `/admin/logistics` are membership-scoped from PostgreSQL; lifecycle and permission
  rules have unit tests.
- **L2 — DELIVERED** Profile editing, branches with one-primary enforcement, operating
  preferences and a company activity feed built on the existing audit log. Company
  navigation links Overview, Profile, Branches, Members, Roles, Settings and Activity;
  all mutations are membership-scoped and audited.
- **L3 — DELIVERED** Fleets, vehicles (including trucks), documents/maintenance,
  company-independent driver profiles with `driver_company_memberships`, compensation
  agreements, shifts and vehicle assignments with reassignment. A driver can belong to
  several companies; no exclusive company ID is stored on the identity.
- **L4 — DELIVERED** `logistics_clients` with optional links to a marketplace
  business/vendor, per-company `company_client_relationships` so one merchant can work
  with several companies, and primary contacts. Relationship status moves
  independently of the global client status.
- **L5 — DELIVERED** Contracts with pricing modes, SLAs, version history, forward-only
  status machine and client acceptance, contract-linked deliveries, allocation progress,
  expiry alerts, and draft-to-issued-to-paid invoices with duplicate-period protection.
  Dedicated fleet and geographic contracts reject overlapping active commitments.
- **L6 — DELIVERED** Company-originated delivery requests on the shared
  `DeliveryRequest`/`DeliveryJob` tables, driver scoring using active memberships and
  branch coverage, assignment/reassignment through `DeliveryAssignment.releasedAt`,
  the unchanged `JOB_TRANSITIONS` lifecycle, OTP verification and contract-linked
  completion. No parallel delivery engine was created.
- **L7 — DELIVERED** Configurable driver compensation rules (fixed, per-delivery,
  percentage, daily, hybrid), earnings with approval, payouts that cannot be marked paid
  without payment evidence, company expenses and period settlements reconciled from
  paid invoices, platform-fee expenses and paid driver payouts.
- **L8 — DELIVERED** Admin-published delivery opportunities ranked by verified
  coverage, capacity, vehicle match, reliability and price. Only verified, eligible
  companies receive offers; companies accept or decline, acceptance creates the job,
  and expired offers are swept by an audited admin action.
- **L9 — DELIVERED** Referral links/codes, merchant attribution with self-referral and
  duplicate checks, and eligibility that requires a verified merchant, active
  relationship, completed deliveries and genuine payments before any reward is created.
  Eligibility points are recorded separately from delivery earnings.
- **L10** External e-commerce APIs. **L11** Fleet sharing and hubs. **L12** AI optimisation.

All slices sit behind the `phase9.logisticsNetwork` feature flag. L1–L9 are
implemented; L10–L12 remain planned and should be delivered one slice at a time.

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
Phase 7 (Ecosystem)                  ← DONE — requires all earlier phases
    ↓
Phase 8 (Trust & Operations)         ← DONE — requires Phase 7 and the payment ledger
    ↓
Phase 9 (Logistics Business Network) ← IN PROGRESS — L1-L9 done; L10 next
```
