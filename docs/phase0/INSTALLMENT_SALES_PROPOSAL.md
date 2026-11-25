# Installment Sales — Seller-Funded Phase 10 Proposal

**Status: IN PROGRESS — slices I1–I3 implemented behind `phase10.installmentSales`
(seeded disabled).**

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
| **I4** | POS/offline sales, inventory reserve-vs-deduct by possession model | Immediate possession deducts stock; deferred possession reserves without marking delivered |
| **I5** | Seller analytics, customer history, disputes and reconciliation | Ledger separation; refunds reverse the correct entries |
| **I6–I9** | Digital signatures/contract management, advanced reporting, and (much later) financing partners | Regulated credit requires separate approval |

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
