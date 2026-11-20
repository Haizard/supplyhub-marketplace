# Current Architecture

> Phase 0 audit — updated after pulling all commits from origin/main (HEAD: 4a923d4).

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.4 (App Router, React 19, Turbopack in dev) |
| Language | TypeScript 5 |
| ORM | Prisma 7 with `@prisma/adapter-pg` (direct pg driver) |
| Database | PostgreSQL (local: Postgres.app 18; hosted: Supabase) |
| Auth | NextAuth v5 (Auth.js) — credentials provider, JWT sessions |
| Payments | LynxPay (custom gateway abstraction) |
| Storage | Local filesystem (dev) / S3-compatible (prod) |
| Email | Nodemailer — SMTP or file outbox in dev |
| Styling | Tailwind CSS v4 |
| UI primitives | Radix UI (dialog, dropdown, toast, slot) |
| Animation | Motion (Framer Motion) |
| Validation | Zod v4 |
| Maps | Leaflet + OpenStreetMap (free, no API key) + OSRM road routing |
| i18n | Custom cookie-based translator (no URL routing) |
| Testing | Vitest (unit), Playwright (e2e) |
| Deployment | Vercel (inferred from scripts and env checks) |

## Application Layout

```
src/
├── app/
│   ├── (auth)/             Sign-in, sign-up, verify-email, forgot/reset password
│   ├── (storefront)/       Public storefront + customer account + admin panel
│   │   └── experience/     NEW: buyer trust & experience centre page
│   ├── (studio)/           Vendor dashboard (seller studio)
│   ├── api/
│   │   ├── auth/           NextAuth handler
│   │   ├── health/         Health check
│   │   ├── search-suggest/ NEW: live search autocomplete with typo correction
│   │   ├── admin/          CSV export endpoints
│   │   ├── vendor/         Vendor CSV exports
│   │   └── webhooks/       LynxPay webhook receiver
│   └── delivery-live/      Live delivery tracking demo page
├── components/
│   ├── auth/               NEW: auth-frame.tsx added
│   ├── delivery/           Live delivery map (Leaflet + OSRM)
│   ├── storefront/         NEW: verified-studio-badge.tsx
│   └── vendor/             NEW: studio-bottom-nav.tsx
├── features/
│   ├── catalog/            NEW: new-arrivals.ts
│   ├── experience/         NEW: full client-side trust & experience suite
│   │   ├── panels/         8 panels (shop, orders, protection, reviews,
│   │   │                   inbox, security, saved, alerts)
│   │   └── widgets/        search-autocomplete, wishlist-button,
│   │                       notification-bell, studio-chat-button
│   └── [existing features unchanged]
├── i18n/                   NEW: full i18n system
│   ├── config.ts           5 locales: en, sw, ar, zh, fr
│   ├── dictionary.ts       Dot-path translator with fallback
│   ├── client.tsx          useT / useI18n hooks
│   ├── server.ts           Server-side translator
│   ├── formatters.ts       Intl number/date formatters per locale
│   ├── language-switcher.tsx
│   └── messages/           en.json, sw.json, ar.json, zh.json, fr.json
├── lib/                    Unchanged
├── server/                 Unchanged
└── types/                  Unchanged
```

## Database (20 tables — schema unchanged from initial commit)

Same 20 tables as before. No new migrations were added in the recent commits — all new features (delivery tracking, experience centre, trust hub, i18n) are implemented client-side or in-memory, with no new database tables.

## New Features Added Since Initial Zip (commit-by-commit)

### 1. Live Delivery Tracking (commits 0923998, db3a311)
- Full client-side delivery simulation using `useSyncExternalStore`
- Leaflet map with OpenStreetMap tiles (free, no API key)
- OSRM road routing (`router.project-osrm.org`) with graceful offline fallback
- Delivery state: `pending → assigned → accepted → to_pickup → at_pickup → transit → delivered`
- Real-time vehicle position interpolation along road geometry
- BroadcastChannel for cross-tab state sync
- LocalStorage persistence across page refreshes
- Seller dispatch panel (assign agents, progress deliveries)
- Courier app view (accept, pick up, complete)
- **Status: UI prototype — no database backend, no real agent assignment**

### 2. Buyer Trust & Experience Centre (commit c823b66)
- New route `/experience` — full-screen sliding panel suite
- 8 panels entirely client-side (localStorage), never touch the server:
  - **Shop**: search, browse, wishlist, price watch
  - **Orders**: sandbox order simulation with escrow, OTP, milestones
  - **Protection**: buyer protection explainer with 12 trust features
  - **Reviews**: verified-purchase review writing (sandbox only)
  - **Inbox**: buyer↔studio chat simulation
  - **Security**: 2FA, phone verify, login alert simulation
  - **Saved**: wishlists and price-watch snapshots
  - **Alerts**: notification centre
- Sandbox payment methods (M-Pesa, Airtel, Mixx, Card) — clearly labelled, never charge
- **Status: UI/UX prototype — no database reads/writes**

### 3. Instant Publishing + New Arrivals (commit 3a6dc0c)
- Vendors can self-publish products directly (bypasses admin review)
- `publishedAt` set immediately on vendor publish action
- New Arrivals section on home page: day / week / month filter
- `parseNewArrivalPeriod` + `newArrivalsSince` utilities in `src/features/catalog/new-arrivals.ts`
- **Status: Fully implemented and database-backed**

### 4. Five-Language i18n (commit 3a6dc0c)
- Cookie-based locale (`supplyhub_locale`) — no URL routing changes
- Languages: English, Kiswahili, Arabic (RTL), Chinese, French
- Server and client translator with dot-path keys and `{var}` interpolation
- Graceful fallback to English for missing keys
- Language switcher component in storefront header
- `dir="rtl"` applied for Arabic
- **Status: Fully implemented**

### 5. Search Autocomplete (commit 3a6dc0c)
- `/api/search-suggest?q=` endpoint
- Levenshtein-distance typo correction against live catalog vocabulary
- Returns ranked products (up to 6), studios (up to 3), departments (up to 3)
- Spelling correction suggestion returned as `corrected` field
- **Status: Fully implemented**

### 6. Mobile Bottom Navigation (commits 0e5cc22, 41d7af5, 7deecc7, 716222b, dbe6677)
- Buyer bottom nav: Home, Search, Cart, Account
- Seller (studio) bottom nav: Overview, Products, Orders, Earnings
- Applied across storefront, studio, and auth pages
- Responsive: visible on mobile/tablet, hidden on desktop (`lg:hidden`)
- **Status: Fully implemented**

### 7. Storefront UX Improvements (commits 91f5436, 554f3e8, a023720, fb272e2)
- Search-first hero replacing image slider
- Department photos on category tiles
- Delivery page with map pinning and distance pricing
- Product gallery refresh
- `VerifiedStudioBadge` component (reflects server-enforced APPROVED status)
- **Status: Fully implemented**

## Auth Architecture (unchanged)

JWT session, `sessionVersion` invalidation, pure policy functions in `policies.ts`.

## Payment Architecture (unchanged)

LynxPay only, full idempotency, `FOR UPDATE` locking, commission ledger on success.

## Delivery Architecture (current state)

- **At checkout**: PICKUP or DELIVERY enum, haversine fee calculation — database-backed
- **Live tracking page** (`/delivery-live`): full client-side simulation — no database
- **No delivery agent entity** exists in the database schema
