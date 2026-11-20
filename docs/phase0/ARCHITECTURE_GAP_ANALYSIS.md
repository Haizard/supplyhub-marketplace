# Architecture Gap Analysis

> Phase 0 audit — updated for HEAD 4a923d4.

## Key Change Since First Audit

Several features that were listed as 🔴 Missing now exist as **client-side prototypes**. This is a new status: the UI and data model exist, but the database and server layer do not. These are marked ⚠️ Prototype.

Converting a prototype to production requires: creating database tables, writing server actions, and replacing localStorage reads/writes with real API calls. The TypeScript types in `experience/types.ts` and `delivery/model.ts` can serve as schema drafts.

---

## Domain A: Identity and Business Organisation

| Required | Current Status | Gap |
|---|---|---|
| User accounts | ✅ | — |
| Email auth + session | ✅ | — |
| Multi-business membership | 🔴 | Need `businesses`, `business_members` |
| Business roles + permissions | 🔴 | Need `business_roles`, `permissions`, `role_permissions`, `member_roles` |
| Business branches | 🔴 | Need `business_branches` |
| Business documents / KYC | 🔴 | Need `business_documents` |
| Business context switching | 🔴 | No concept of "active business" in session |

---

## Domain B: Business Operating System

| Required | Current Status | Gap |
|---|---|---|
| Inventory ledger (single-location) | ✅ | `inventory_movements` exists |
| Inventory ledger (multi-location) | 🔴 | Need `warehouses`, `inventory_balances` |
| POS | 🔴 | Entirely missing |
| Expense management | 🔴 | Missing |
| Finance / profit-loss | 🔴 | Missing |

---

## Domain C: CRM and Suppliers

| Required | Current Status | Gap |
|---|---|---|
| Vendor-scoped customer profiles | 🔴 | Missing |
| Loyalty programme | 🔴 | Missing |
| Supplier directory + purchase orders | 🔴 | Missing |

---

## Domain D: Employee Management

| Required | Current Status | Gap |
|---|---|---|
| Staff accounts per business | 🔴 | 1:1 user↔vendor only |
| Permission enforcement per employee | 🔴 | Flat roles only |

---

## Domain E: B2C Marketplace

| Required | Current Status | Gap |
|---|---|---|
| Product catalogue | ✅ | — |
| Instant publishing | ✅ | NEW: vendors self-publish |
| Multi-vendor checkout | ✅ | — |
| Search autocomplete + typo correction | ✅ | NEW: `/api/search-suggest` |
| New arrivals section | ✅ | NEW |
| i18n (5 languages) | ✅ | NEW |
| Verified studio badge | ✅ | NEW |
| Product variants | 🔴 | Single SKU only |
| Wishlists (persistent) | ⚠️ Prototype | localStorage only |
| Price watch | ⚠️ Prototype | localStorage only |
| Product reviews (real) | 🔴 | Sandbox prototype only |
| Order status history | 🔴 | No history table |
| Customer-initiated returns | 🔴 | No real return flow |
| Coupon / discount codes | 🔴 | Missing |

---

## Domain F: B2B Wholesale

| Required | Current Status | Gap |
|---|---|---|
| Wholesale listings | 🔴 | Entirely missing |
| RFQ / quotation system | 🔴 | Missing |
| Business purchase orders | 🔴 | Missing |

---

## Domain G: Logistics Network

| Required | Current Status | Gap |
|---|---|---|
| Delivery choice at checkout | ✅ | — |
| Delivery fee calculation | ✅ | — |
| Live tracking UI + road routing | ⚠️ Prototype | Full UI, no DB backend |
| Delivery state machine (client) | ⚠️ Prototype | pending → delivered, localStorage only |
| Delivery agent entity (database) | 🔴 | No `delivery_agents` table |
| Dispatch engine | 🔴 | Missing |
| OTP / proof of delivery | 🔴 | Simulated in prototype |
| Agent earnings | 🔴 | Missing |
| External delivery requests | 🔴 | Missing |

**Transition path**: `src/components/delivery/model.ts` defines `Delivery`, `DeliveryAgent`, `DeliveryStatus` — use these as the schema specification for Phase 4 database tables.

---

## Domain H: Payments and Subscriptions

| Required | Current Status | Gap |
|---|---|---|
| Online payment (LynxPay) | ✅ | — |
| Commission ledger | ✅ | — |
| Vendor payouts | ✅ | — |
| Sandbox payment simulation | ⚠️ Prototype | Experience centre only |
| Cash on delivery | 🔴 | Missing |
| Escrow / payment holding | 🔴 | Simulated prototype only |
| Subscription plans | 🔴 | Missing |
| Agent payout | 🔴 | Missing |

---

## Domain I: Trust and Verification

| Required | Current Status | Gap |
|---|---|---|
| Vendor approval workflow | ✅ | — |
| Verified studio badge | ✅ | NEW: shown across catalog |
| Buyer protection explainer (12 features) | ⚠️ Prototype | UI only, no enforcement |
| Real buyer↔studio chat | 🔴 | localStorage simulation only |
| Real dispute resolution | 🔴 | Missing |
| Escrow / held payments | 🔴 | Prototype only |
| Vendor reliability score | 🔴 | Missing |

---

## Domain J: AI Intelligence

| Required | Current Status | Gap |
|---|---|---|
| Levenshtein typo correction in search | ✅ | NEW: in search-suggest API |
| AI shopping assistant | 🔴 | Missing |
| Vendor business analytics / insights | 🔴 | Missing |

---

## Prototype Conversion Priority

The following prototypes have enough UI and data model work done that converting them to real features is the most efficient path forward — rather than building from scratch:

| Prototype | Effort to Convert | Business Value | Priority |
|---|---|---|---|
| Wishlists + price watch | Low — simple DB tables | High | Phase 3 |
| Product reviews | Medium — needs verified-purchase check | High | Phase 3 |
| Delivery tracking | High — full logistics backend needed | Very High | Phase 4 |
| Buyer↔studio chat | High — real-time messaging | Medium | Phase 6 |
| Escrow / buyer protection | Very High — financial and legal implications | Very High | Phase 4+ |
| Security (2FA, phone) | Medium — auth library integration | High | Phase 2 |

---

## Reusable Components (safe to build on, unchanged)

| Component | Location |
|---|---|
| DB client | `src/server/db/client.ts` |
| Supabase/local URL resolver | `src/lib/config/database-url.ts` |
| Auth guards + policies | `src/server/auth/` |
| Audit log | `src/server/audit/audit-log.ts` |
| Payment service | `src/features/payments/service.ts` |
| Commission ledger | `src/features/payments/ledger.ts` |
| Checkout service | `src/features/checkout/service.ts` |
| Inventory movement ledger | `inventory_movements` table |
| Zod env validation | `src/lib/config/env.ts` |
| i18n translator | `src/i18n/` |
| Delivery data model (as schema draft) | `src/components/delivery/model.ts` |
| Experience state types (as schema draft) | `src/features/experience/types.ts` |
