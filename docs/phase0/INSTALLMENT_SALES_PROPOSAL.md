# Installment Sales — Seller-Funded Phase 10 Proposal

**Status: DELIVERED — slices I1–I9 implemented. Operator approved activation on
2026-11-26; both `phase10.installmentSales` and `phase10.installmentFinancing`
are enabled. Financing remains record-only: no partner calls, credit decisions,
payouts or money movement by the platform.**

This document records the repository-first decisions for the Installment Sales /
BNPL / layaway capability requested in the product brief. The platform implements
**seller-funded** installments only: the seller sets the terms, carries the
repayment risk, and the platform provides agreements, schedules, payment
infrastructure, reminders and reporting. A regulated platform-financed credit
product is explicitly out of scope.

## 1. Repo-first mapping

The brief's proposed tables were checked against the existing schema before any
code was written:

| Proposed | Decision |
|---|---|
| `installment_products` | New `InstallmentSetting` per `Business`; catalogue products stay untouched and are snapshotted into each agreement. |
| `installment_agreements` | New `InstallmentAgreement` linked to `Business`, `User` (buyer) and optional `Order`. |
| `installment_agreement_items` | New `InstallmentAgreementItem` with price snapshots; no product FK so catalogue edits cannot rewrite history. |
| `installment_schedules` | New `InstallmentSchedule` with unique `(agreementId, sequence)`. |
| `installment_payments`, `allocations` | **Not in I1.** Reuses `Payment`, LynxPay callback verification and the payment ledger when I2 lands. |
| `installment_agreement_events` | New `InstallmentAgreementEvent` plus audit-log entries. |
| `reminders`, `disputes`, `documents` | Planned for later slices; reminder/document infrastructure already exists in `src/features/messaging` and outbox. |
| Marketplace, POS, inventory, CRM, accounting | Existing modules in `src/features/{b2b,pos,inventory,crm,reconciliation}`; integrations come in later slices. |

## 2. Non-negotiable decisions

- **Separate agreement entity** — never `payment_status = partial` on `Order`.
- **Immutable snapshot** — seller identity, buyer identity, item, prices, currency,
  possession terms and full schedule are frozen at creation. Later catalogue or
  settings changes never mutate an existing agreement.
- **Server-authoritative money** — cash price is computed from quantity × unit
  price; currency comes from seller settings; outstanding balance and schedule
  are computed in integer minor units. No client-supplied total is trusted.
- **Payment truth** — a payment is never marked successful on checkout return.
  I2 will require verified provider callbacks with idempotent webhooks; I1
  records no payments at all.
- **No invented policy** — interest, extra charges, late fees, grace periods and
  advance payments are recorded as disabled/configurable defaults. Interest and
  charges are always zero in I1; local compliance review is required before any
  of these levers are applied.
- **Tenant isolation** — seller actions resolve `Business` membership through
  `resolveBusinessContext()` and require the new `installments.manage` permission;
  buyer reads/writes are scoped to the authenticated user ID.
- **Status discipline** — agreement status (`PENDING_DEPOSIT`, `OVERDUE`, etc.) is
  distinct from per-instalment payment status (`PENDING`, `PAID`, ...).

## 3. Delivery slices

| Slice | Deliverable | Gate |
|---|---|---|
| **I1** (done) | Seller settings, agreement creation with frozen snapshot, generated schedule, buyer acceptance, pre-activation cancellation, seller/buyer views | No client-supplied price/total; schedule sums exactly to outstanding; buyer accepts only from own session; flag disabled by default |
| **I2** (done) | Verified deposit + payment allocation, overpayment, early settlement, partial payments, immutable transaction history | No success without verified callback; duplicate webhooks idempotent; overpay only when seller permits |
| **I3** (done) | Buyer dashboard enhancements, receipts, reminders, overdue management | Reminders are notifications only; grace/late fees stay configurable |
| **I4** (done) | POS/offline sales, inventory reserve-vs-deduct by possession model | Immediate possession deducts stock; deferred possession reserves without marking delivered |
| **I5** (done) | Seller analytics, customer history, disputes and reconciliation | Ledger separation; refunds reverse the correct entries |
| **I6** (done) | Versioned, signed contract documents and amendment history | Frozen snapshot never rewritten; both parties sign explicitly |
| **I7** (done) | Advanced reporting: aging, collection forecast, repayment KPIs | Pure integer-minor-unit calculations |
| **I8** (done) | Prepared financing-partner interface | Separate disabled flag; no partner calls, credit decision or money movement |
| **I9** (done, gated) | Offer decision, buyer acceptance and funding-reference records | No disbursement, credit decision or provider call; compliance approval required to enable |

## 4. I1 acceptance

- Flag `phase10.installmentSales` seeded disabled; every action checks it.
- New permission `installments.manage` granted to system business roles only.
- Money math and schedules are pure, unit-tested functions in `src/features/installments/rules.ts`.
- Agreement statuses used in I1: `PENDING_CUSTOMER_ACCEPTANCE`, `PENDING_DEPOSIT`, `CANCELLED`.
- Buyer acceptance records timestamp + method (`ACCOUNT_SESSION`); sellers cannot accept for buyers.
- Migration `20261125000000_phase10_installments_i1`.

### I2 acceptance

- `POST /api/webhooks/installments/lynxpay` verifies LynxPay HMAC signatures, caps
  the body, parses with the shared provider schema, and matches our payment
  reference (`external_id`), amount and currency before applying anything.
- Duplicate deliveries are rejected by the unique `(provider, deliveryId)` event
  key; duplicate provider payment IDs cannot allocate twice. Failed/mismatched
  callbacks are recorded as events and never create allocations.
- `InstallmentPayment` + immutable `InstallmentPaymentAllocation` rows record
  reference, method, amount, currency, timestamps, verification status and
  per-instalment application. No provider secret or phone number is stored in
  event payloads.
- Allocation is pure and tested: partial payments, partial instalments, early
  settlement, overpayment gating, and refund reversal in reverse order.
- Agreement moves `PENDING_DEPOSIT → ACTIVE` once verified payments cover the
  deposit, and `→ COMPLETED` only when the schedule is fully paid. Refunds reverse
  allocations and restore the outstanding balance.
- Seller-attested cash/bank payments are audited with the actor ID; provider
  payments are verified only by callbacks. Migration `20261125100000_phase10_installments_i2`.

### I3 acceptance

- One `InstallmentReceipt` per verified payment, issued inside the verification
  transaction. `GET /api/installments/receipts/[receiptId]` is buyer-scoped,
  `no-store`, and streams a plain-text attachment built from the frozen snapshot.
- `POST /api/admin/installments/reminders` requires an administrator session and
  supports `SWEEP`, `DISPATCH` or `BOTH`. The sweep marks unpaid instalments
  `OVERDUE` only after the seller's configured grace period and queues at most one
  reminder per `(agreement, instalment, type)`; the dispatcher skips reminders
  whose instalment was already paid and records send/failure audit entries.
- Reminders use the shared SMTP configuration and never contain credentials,
  payment references beyond the agreement number, or provider payloads.
- No late charges, penalties or collection action are applied. Migration
  `20261125200000_phase10_installments_i3`.

### I4 acceptance

- Selecting a catalogue product on an agreement overrides the client-supplied
  unit price with the product's published price and holds stock inside the same
  transaction. Both catalogue `stock` and the default warehouse balance must
  cover the quantity, so reserved units cannot be sold twice.
- A `RESERVE` inventory movement records the hold. The reservation converts to
  `SOLD` only on `ACTIVE` for `IMMEDIATE` possession or `COMPLETED` for
  `AFTER_FULL_PAYMENT` — no second stock decrement. Cancellation before sale
  releases the units with a `RELEASE` movement.
- POS cashiers can create installment agreements from `/vendor/pos`; the product
  price is catalogue-authoritative and stock is held, not sold as a completed
  POS transaction.
- Refunds reverse money and allocations only; any physical stock return goes
  through the existing returns process. Migration
  `20261125300000_phase10_installments_i4`.

### I5 acceptance

- Seller report at `/business/[id]/installments/reports` derives totals from
  stored agreements and verified payments: sales, deposits collected,
  outstanding balance, monthly collections, upcoming/overdue counts, completed
  and defaulted agreements, and monthly revenue. All money math is in integer
  minor units and unit-tested.
- Customer history searches only agreements of the authorized business.
- Buyers and sellers can open disputes on their own agreements; opening one sets
  the agreement to `DISPUTED`. Only sellers close disputes, with a recorded
  resolution and audit trail. No money moves in a dispute action.
- Reconciliation runs are business-scoped and append-only. Findings cover missing
  receipts, allocation/currency mismatches and missing provider references. No
  finding mutates a payment; refunds remain the only reversal path.
- Migration `20261125400000_phase10_installments_i5`.

### I6–I8 acceptance

- Contract versions are generated from the immutable snapshot with a SHA-256
  content hash. Buyer and seller each sign exactly once per version from their
  own authenticated session; a version is `SIGNED` only after both signatures.
  Voiding retains history. Amendments are proposed/responded to and never mutate
  the frozen financial terms.
- Advanced reports compute receivables aging (0/1–30/31–60/60+ days), collection
  forecast horizons (30/60/90 days) and repayment KPIs from stored schedules.
- The financing interface records an application only when the separate
  `phase10.installmentFinancing` flag is enabled. I9 adds admin decision,
  buyer acceptance and partner funding-reference records at
  `/admin/installments/financing`; the platform still disburses nothing. The
  operator approved activation on 2026-11-26; migration
  `20261126100000_enable_installment_flags` enables both flags and `scripts/seed.mjs`
  seeds them enabled for fresh deployments. Full regulated credit disbursement
  remains out of scope.
