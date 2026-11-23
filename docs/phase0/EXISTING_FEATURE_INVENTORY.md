# Existing Feature Inventory

> Phase 0 audit — updated for HEAD 4a923d4.
> Status: ✅ Fully implemented · ⚠️ Partial/prototype · 🔴 Missing

## Authentication & Identity

| Feature | Status | Notes |
|---|---|---|
| Email + password sign-up | ✅ | With email verification token |
| Email verification | ✅ | Time-limited token, Nodemailer |
| Sign-in | ✅ | Argon2id, constant-time dummy hash |
| Password reset | ✅ | Forgot/reset flow |
| Session invalidation | ✅ | `sessionVersion` on users table |
| Rate limiting on auth | ✅ | In-memory sliding window |
| JWT session | ✅ | 7-day maxAge, 24h refresh |
| Multi-business / multi-role per user | 🔴 | Single global role only |
| Business membership model | 🔴 | No `businesses` or `business_members` |

## Vendor (Business) Management

| Feature | Status | Notes |
|---|---|---|
| Vendor application | ✅ | Form at `/vendor/apply` |
| Vendor review (approve / reject / suspend) | ✅ | Full admin workflow |
| Vendor appeal | ✅ | Vendor appeals; admin reviews |
| Vendor profile editing | ✅ | Name, description, coordinates, contact |
| Vendor departments (categories) | ✅ | Pivot table |
| Vendor storefront (public page) | ✅ | `/vendors/[slug]` |
| Verified studio badge | ✅ | NEW: `VerifiedStudioBadge` — reflects DB-enforced APPROVED status |
| Multi-branch vendor | 🔴 | Single location per vendor |
| Multiple employees per vendor | 🔴 | 1:1 user↔vendor |
| Staff roles and permissions | 🔴 | No sub-vendor role system |
| POS (point of sale) | 🔴 | Not present |
| Vendor business analytics | 🔴 | No analytics beyond order list |
| Vendor CRM | 🔴 | Not present |
| Supplier / procurement management | 🔴 | Not present |

## Catalog & Products

| Feature | Status | Notes |
|---|---|---|
| Product creation | ✅ | Full form in vendor studio |
| Product editing | ✅ | Name, price, stock, images |
| Instant self-publishing | ✅ | NEW: vendors publish directly, no admin review required |
| Admin-moderated publishing | ✅ | Still available; admin can publish/reject/archive |
| Product categories (hierarchical) | ✅ | Infinite depth, slug routing |
| Product images (upload/manage) | ✅ | S3 or local, approval workflow |
| Product search (full-text) | ✅ | `searchText` column |
| Search autocomplete with typo correction | ✅ | NEW: `/api/search-suggest`, Levenshtein distance |
| New arrivals (day / week / month) | ✅ | NEW: `newArrivalsSince` utility, home page section |
| Product variants (size/colour/SKU) | 🔴 | Single SKU per product |
| Bulk product upload (CSV) | 🔴 | Not present |
| Product comparison | 🔴 | Not present |
| Wishlists | ✅ | DB-backed `WishlistItem`; `/account/wishlist` and experience centre saved panel |
| Price watch / alerts | ⚠️ | NEW: client-side only in experience centre |
| Product reviews / ratings | ⚠️ | NEW: client-side sandbox only in experience centre |

## Inventory

| Feature | Status | Notes |
|---|---|---|
| Stock tracking | ✅ | `products.stock` integer |
| Inventory movement ledger | ✅ | Immutable `inventory_movements` |
| Manual stock adjustment (admin) | ✅ | Admin panel |
| Stock reservations | ⚠️ | Implicit via atomic decrement at checkout; no `stock_reservations` table |
| Multi-warehouse / multi-location | 🔴 | Single stock figure per product |
| Low-stock alerts | 🔴 | Not present |
| Reorder levels | 🔴 | Not present |

## Cart & Checkout

| Feature | Status | Notes |
|---|---|---|
| Cart (authenticated + guest) | ✅ | Guest token hash in cookie |
| Multi-vendor checkout | ✅ | Single checkout → parent + vendor sub-orders |
| Delivery method (pickup / delivery) | ✅ | Enum on order |
| Delivery distance + fee calculation | ✅ | Haversine, per-km + minimum |
| Stock reservation at checkout | ✅ | Atomic conditional decrement |
| Reservation expiry + stock release | ✅ | Background sweep |
| Coupon / discount codes | 🔴 | Not present |
| Group buying | 🔴 | Not present |
| Scheduled delivery | 🔴 | Not present |

## Payments

| Feature | Status | Notes |
|---|---|---|
| Online payment via LynxPay | ✅ | M-Pesa, Tigo, Airtel, Halo Pesa |
| Idempotent payment attempts | ✅ | `idempotency_key` unique constraint |
| Webhook handling | ✅ | Signature verification, deduplication |
| Commission ledger | ✅ | VENDOR_EARNING + PLATFORM_COMMISSION |
| Refunds | ✅ | Via gateway + ledger reversal |
| Payout management (admin) | ✅ | PENDING → PAID state machine |
| Vendor earnings view | ✅ | In vendor studio |
| Sandbox payment simulation | ⚠️ | NEW: client-side only in experience centre; never charges real accounts |
| Cash on delivery | 🔴 | Not present |
| Subscription billing | 🔴 | Not present |
| Payment reconciliation (automated) | 🔴 | Manual only |

## Orders

| Feature | Status | Notes |
|---|---|---|
| Order placement | ✅ | Fully transactional |
| Order status (customer view) | ✅ | `/orders/[orderNumber]` |
| Vendor order management | ✅ | Vendor can view and update status |
| Sandbox order simulation with escrow + OTP | ⚠️ | NEW: client-side only in experience centre |
| Order status history | 🔴 | No history table; current status only |
| Customer-initiated returns | 🔴 | No real return flow (sandbox only) |
| Delivery tracking (live) | ⚠️ | NEW: full UI prototype, no database backend |

## Delivery & Logistics

| Feature | Status | Notes |
|---|---|---|
| Delivery method choice at checkout | ✅ | PICKUP / DELIVERY |
| Delivery fee calculation (haversine) | ✅ | Per-km rate + minimum |
| Live delivery map (OpenStreetMap + Leaflet) | ⚠️ | NEW: full UI prototype, demo data only |
| Road routing (OSRM) | ⚠️ | NEW: live road geometry, falls back gracefully offline |
| Delivery status state machine | ⚠️ | NEW: client-side only (pending → delivered) |
| Delivery agent entity (database) | 🔴 | No `delivery_agents` table |
| Dispatch engine | 🔴 | Not present |
| Delivery OTP / proof of delivery | 🔴 | Simulated in experience centre only |
| Agent earnings / payouts | 🔴 | Not present |
| External delivery requests | 🔴 | Not present |

## Buyer Experience & Trust

| Feature | Status | Notes |
|---|---|---|
| Verified studio badge | ✅ | NEW: DB-enforced, shown on all catalog products |
| Experience centre (`/experience`) | ⚠️ | Mixed: chat and saved objects are DB-backed; orders/protection/security remain sandbox |
| Buyer protection explainer | ⚠️ | NEW: 12 trust features documented (UI only) |
| Wishlist (persistent) | ✅ | DB-backed via `WishlistItem`, shared by catalog and experience centre |
| Price watch notifications | 🔴 | Client-side localStorage only |
| Buyer↔studio chat | ✅ | DB-backed threads at `/messages` and `/vendor/messages`, with read receipts |
| Security (2FA, phone verify) | 🔴 | Client-side simulation only |
| Dispute resolution | 🔴 | Not present |
| Escrow / payment holding | 🔴 | Simulated in experience centre; no real escrow |

## Internationalisation

| Feature | Status | Notes |
|---|---|---|
| English (en) | ✅ | NEW: full message dictionary |
| Kiswahili (sw) | ✅ | NEW: Tanzanian primary market language |
| Arabic (ar) with RTL layout | ✅ | NEW: `dir="rtl"` applied |
| Chinese (zh) | ✅ | NEW |
| French (fr) | ✅ | NEW |
| Cookie-based locale (no URL routing) | ✅ | NEW: `supplyhub_locale` cookie |
| Language switcher | ✅ | NEW: in storefront header |

## Mobile & PWA

| Feature | Status | Notes |
|---|---|---|
| Buyer bottom navigation | ✅ | NEW: Home, Search, Cart, Account |
| Seller (studio) bottom navigation | ✅ | NEW: Overview, Products, Orders, Earnings |
| PWA manifest + service worker | ✅ | Offline page, icons |
| Responsive layout across all pages | ✅ | NEW: consistent mobile layout applied everywhere |

## Admin Panel

| Feature | Status | Notes |
|---|---|---|
| Vendor approval / rejection / suspension | ✅ | Full workflow |
| Product moderation | ✅ | Publish / reject / archive |
| Category management | ✅ | Create, edit, archive |
| User management | ✅ | View, suspend, reactivate |
| Order management | ✅ | View all orders |
| Payment management + refunds | ✅ | View payments, initiate refunds |
| Payout management | ✅ | Approve, mark paid, reconcile |
| Audit log | ✅ | View all recorded actions |
| CSV exports | ✅ | Orders, products, users |
| Business verification (KYC) | 🔴 | Not present |
| Subscription management | 🔴 | Not present |
| Dispute resolution centre | 🔴 | Not present |
| Platform analytics dashboard | 🔴 | No aggregate metrics |

## B2B / Wholesale

| Feature | Status | Notes |
|---|---|---|
| Wholesale listings | ✅ | `/b2b/wholesale` catalog, `/vendor/wholesale` management, volume price tiers |
| RFQ / quotation system | ✅ | `/b2b/rfq` buyers, `/vendor/rfq` suppliers, state machine + audit trail |
| B2B purchase orders | ✅ | Buyer creation, supplier fulfilment lifecycle, `/b2b/purchase-orders` |
| B2B invoices | ✅ | Supplier issuance, buyer payment tracking, `/b2b/invoices` |

## AI & Personalization

| Feature | Status | Notes |
|---|---|---|
| Search typo correction | ✅ | NEW: Levenshtein distance in `/api/search-suggest` |
| AI shopping assistant | 🔴 | Not present |
| Personalized recommendations | 🔴 | Not present |
| Vendor business intelligence | 🔴 | Not present |
