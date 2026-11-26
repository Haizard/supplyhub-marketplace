# Agriculture Business Network — Phase 11 Proposal

**Status: IN PROGRESS — Phases A–C implemented behind `phase11.agricultureNetwork`
(seeded disabled). Phases D–F remain proposed.**

This is the repo-first specification for the Agriculture Business Network described
in the product brief. The goal is a vertical built on the existing platform core —
identity, businesses, marketplace, payments, installments, logistics, notifications
and AI — not a second application or a duplicate commerce engine.

## 1. Repo-first findings

- No `farms`, `crops`, `harvest`, `agricultural_*` or matching permission keys exist
  in `prisma/schema.prisma`, `src/features/` or the roadmap. This is a new domain.
- Reusable core already in place:
  - `Business` / `resolveBusinessContext()` for tenant isolation and permissions.
  - `Product`, `Order`, `VendorOrder`, `Payment`, `InstallmentAgreement` for
    catalogued trade, verified payments and supplier-funded credit.
  - `DeliveryRequest`, `DeliveryJob`, logistics companies and parcel hubs for farm
    pickup, bulk transport and collection centres.
  - `src/features/outbox/`, `src/features/insights/gemini.ts`, `messaging` and the
    five-locale i18n dictionaries for notifications, opt-in AI and UI.
- Therefore agriculture should be a domain overlay with explicit links to these
  shared entities, never a parallel set of orders or payments.

## 2. Design decisions (non-negotiable)

- **Tenant isolation**: every farm, plot, crop record, listing and booking resolves
  its owner from the session through a new `resolveFarmContext()`, mirroring
  `resolveBusinessContext()`. No client-supplied owner ID is trusted.
- **Verified counterparties**: input sellers (especially fertilizers, pesticides,
  veterinary supplies) and service providers require verification before selling.
  Certification claims are recorded as data, never assumed true.
- **Money truth**: verified provider callbacks only; no listing, offer or contract
  marks a payment paid on checkout return. Currency defaults to TZS, `Decimal`, no
  floating point.
- **No invented policy**: grading standards, quality rules, late charges, prices,
  warehouse receipts and financing terms stay configurable and explicitly labelled.
- **No platform credit**: agricultural input installments reuse supplier-funded
  `InstallmentAgreement`. Platform-financed lending remains out of scope.
- **AI is opt-in and advisory**: reuse `AI_INSIGHTS_PROVIDER=gemini` +
  `GEMINI_API_KEY`; disease or input advice must express uncertainty, avoid personal
  data and defer to qualified specialists. Deterministic rules remain the fallback.
- **Tanzania-first**: Kiswahili/English, TZS, mobile-first, region/district/ward/village
  location, kg/tonne/bag/acre/hectare with documented conversions. Mobile money via
  the existing LynxPay gateway only where supported.
- **Expected harvest is not income**: forecasts are stored separately from realized
  sales and receipts.

## 3. Phased delivery

| Phase | Deliverable | Gate |
|---|---|---|
| **A — Agricultural marketplace (done)** | Farmer/farm profiles, plots, produce listings, buyer discovery, quotations, orders, verified payments | A buyer can transact with a farmer through shared `Order`/`Payment`; no cross-tenant reads |
| **B — Inputs and services (done)** | Verified input catalogue (incl. manure/compost), service providers, quotations and bookings | Sensitive inputs require verification; bookings never double-book a provider |
| **C — Farm management (done)** | Crop cycles, activities, expenses, harvest batches, per-kg cost, seasonal records | Cost math tested; production data owned by farm member only |
| **D — Agricultural logistics** | Farm pickup, bulk delivery, collection centres, storage listings, logistics-company jobs | Uses existing delivery engine; no duplicate assignment system |
| **E — Cooperatives and contracts** | Farmer groups, aggregated supply, bulk buyer requests, harvest purchase agreements | Group actions authorized; contracts snapshot quantity, quality and pricing |
| **F — AI and intelligence** | Opt-in crop planning, cost/yield assistance, market intelligence and buyer matching | Deterministic baseline fallback; no PII or invented agronomic advice |

Pilot recommendation: one crop, one region, a small set of farmer groups, verified
input suppliers and bulk buyers. Validate real listings, grading, delivery and
completed payments before expanding.

## 4. Entity mapping (subject to the schema audit above)

New domain models: `Farm`, `FarmPlot`, `FarmCrop`, `CropActivity`, `FarmExpense`,
`HarvestBatch`, `AgriculturalListing`, `AgriculturalBuyerRequest`,
`AgriculturalOffer`, `AgriculturalContract`, `AgriculturalInput`,
`AgriculturalServiceProvider`, `AgriculturalServiceBooking`, `FarmerGroup`,
`FarmerGroupMember`, `AgriculturalInspection`, `AgriculturalStorage`.

Reused rather than duplicated: `User`, `Business`, `Product`, `Order`, `Payment`,
`InstallmentAgreement`, `DeliveryRequest`/`DeliveryJob`, `OutboxEvent`, feature flags.

Flag: `phase11.agricultureNetwork`, seeded disabled until the pilot is approved.
Permission keys: `agriculture.farm.manage`, `agriculture.trade.manage`,
`agriculture.inputs.manage`, `agriculture.services.manage`,
`agriculture.group.manage`, `agriculture.logistics.manage`.

### Phase A acceptance

- Farmer profiles resolve from the session only; publishing requires admin
  verification at `/admin/agriculture`.
- Farms and plots are scoped to the farmer. Listings are validated against unit,
  minimum order, currency and published status; organic/certified claims are
  explicitly labelled unverified.
- Bulk buyer requests and offers use pure validation rules. Accepting an offer
  creates a shared `Order` and `AgriculturalContract` snapshot and starts payment
  through the existing LynxPay flow — no payment is marked paid on checkout return.
- Migration `20261127000000_phase11_agriculture_a`; tests in
  `tests/unit/agriculture-a.test.ts`.

### Phase B acceptance

- Suppliers are verified by an administrator at `/admin/agriculture`. Regulated
  input categories (seed, fertilizer, crop protection, feed, veterinary) require
  a registration/licence reference; spraying, soil testing and agronomy services
  require a qualification reference. Organic/certified claims are unverified.
- Bookings follow REQUESTED → QUOTED → CONFIRMED → IN_PROGRESS → COMPLETED with
  cancellation, and confirmed jobs cannot overlap on the same provider day.
- Input purchases create a shared `Order` and start verified LynxPay payment; no
  payment is marked paid on checkout return.
- Migration `20261128000000_phase11_agriculture_b`; tests in
  `tests/unit/agriculture-b.test.ts`.

### Phase C acceptance

- Crop cycles, activities, expenses and harvest batches are scoped to the
  session-resolved farmer; farm and plot ownership is verified on every mutation.
- Production cost per kilogram is computed from recorded expenses and recorded
  harvest weights in integer minor units. Expected harvest is never treated as
  realised income or included in cost calculations.
- Migration `20261129000000_phase11_agriculture_c`; tests in
  `tests/unit/agriculture-c.test.ts`.

## 5. Next step

Implementation should start with **Phase A only**, following the same incremental
slice pattern used for Phases 9 and 10. No code is written until this proposal is
accepted and the first slice is confirmed.
