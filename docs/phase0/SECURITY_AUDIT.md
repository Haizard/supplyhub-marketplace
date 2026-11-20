# Security Audit

> Phase 0 audit — updated for HEAD 4a923d4.

## What Changed Since Last Audit

New features added in recent commits introduce new surface area to review:
- Live delivery tracking (client-side, OSRM external fetch)
- Experience centre (client-side localStorage store)
- Search autocomplete API endpoint
- Instant vendor self-publishing
- i18n cookie

---

## ✅ Confirmed Strengths (unchanged)

- Argon2id password hashing with constant-time dummy hash
- `sessionVersion` invalidation
- Pure policy functions, no middleware
- `FOR UPDATE` row locking on payment state transitions
- Idempotent payment processing
- Webhook signature verification + deduplication
- Server-side storage keys, image validation
- In-memory rate limiter on auth endpoints
- Account tokens stored as hashes
- `server-only` imports on all server modules
- `Decimal` type for all money — no float risk
- Order item snapshots are immutable

---

## New Issues Found

### 🔴 HIGH — Instant Publishing Bypasses Moderation

**Commit**: 3a6dc0c  
**File**: `src/features/catalog/vendor-actions.ts` (lines ~255, ~423)  
**What changed**: Vendors can now self-publish products directly to `PUBLISHED` status without admin review.  
**Risk**: A malicious or negligent vendor can publish counterfeit, prohibited, or misleading products instantly with no human check. This is a trust and legal risk for the platform.  
**Recommendation**: Either revert to requiring admin review, or implement automated checks (prohibited keywords, image moderation, price sanity) before allowing instant publishing. At minimum, add a post-publish audit queue so the admin team can flag and unpublish quickly.

---

### ⚠️ MEDIUM — Experience Centre State is Entirely Client-Controlled

**Files**: `src/features/experience/` (all files)  
**Risk**: All "trust" features (escrow, OTP verification, buyer protection, 2FA, reviews, chat) are simulated in localStorage. If users mistake these for real features:
- They may believe their money is in escrow when it is not
- They may believe they have 2FA protection when they do not
- Fake "verified purchase" reviews could be used to deceive buyers

**Recommendation**: The experience centre must be clearly and permanently labelled as a demo/prototype in every UI state. Before any of these panels are presented to real users as functional, they must be backed by real server state and database records.

---

### ⚠️ MEDIUM — OSRM External Service Call Without Rate Limiting

**File**: `src/components/delivery/model.ts` (`fetchRoadRoute`)  
**What it does**: Calls `https://router.project-osrm.org` for road geometry. This is a free public demo server.  
**Risks**:
1. The public OSRM demo server has no SLA and may be rate-limited or shut down — the app falls back gracefully, but the feature degrades silently.
2. If this call is triggered in a loop or by many concurrent users, it could constitute abuse of a free public service.  
**Recommendation**: Before production use, self-host OSRM or use a commercial routing API. Add a server-side proxy so the routing call comes from your server (not each user's browser), enabling rate limiting and caching.

---

### ⚠️ MEDIUM — Search Suggest Endpoint Has No Rate Limiting

**File**: `src/app/api/search-suggest/route.ts`  
**What it does**: Runs a full catalog query (`listProducts({ limit: 48 })`) plus Levenshtein distance scoring on every request.  
**Risk**: This endpoint fetches up to 48 products, all vendors, and all categories on every keystroke from every user. Without rate limiting or caching, it is a cheap denial-of-service vector.  
**Recommendation**: Add rate limiting (reuse existing rate-limiter) and cache the catalog result for 30–60 seconds. The Levenshtein scoring is CPU-only so it's fast, but the DB fetch is the bottleneck.

---

### ⚠️ MEDIUM — i18n Cookie Has No Security Flags

**File**: `src/i18n/config.ts`, locale cookie set somewhere in the i18n layer  
**Risk**: If the `supplyhub_locale` cookie is set without `HttpOnly` and `SameSite` flags, it is readable by JavaScript and potentially settable by cross-site requests.  
**Note**: Since the locale is non-sensitive, this is low severity in isolation. However, it sets a precedent for cookie handling.  
**Recommendation**: Set locale cookie with `SameSite=Lax; Path=/` at minimum. It does not need `HttpOnly` since the client needs to read it, but `SameSite` protects against CSRF.

---

### ✅ No New Concerns: Instant-Publish Audit Logging

The self-publish action does correctly write an audit event (`PRODUCT_PUBLISHED` with `selfPublished: true` in metadata), so there is a record of every vendor self-publish. This is good — it makes the missing moderation step at least auditable.

---

## Unchanged Gaps (from first audit, still unresolved)

1. **No Row-Level Security on the database** — tenant isolation is application-only
2. **No `CHECK (stock >= 0)` on `products`** — stock can go negative from a bug
3. **In-memory rate limiter** — per-process, fails on multi-instance deployments
4. **No CSP / security headers** in `next.config.ts`
5. **Payout `APPROVED` and `PROCESSING` transitions** not audited
6. **No `resolveBusinessContext` utility** — required before Business OS

---

## Revised Priority Order

| Priority | Issue |
|---|---|
| 🔴 1 | Instant publishing without moderation — platform trust risk |
| 🔴 2 | Experience centre features presented without clear demo labelling — user deception risk |
| 🔴 3 | No tenant isolation for Business OS (before Phase 1 goes live) |
| ⚠️ 4 | Search suggest endpoint — no rate limiting or caching |
| ⚠️ 5 | Add `CHECK (stock >= 0)` DB constraint |
| ⚠️ 6 | Add CSP / security headers |
| ⚠️ 7 | Replace in-memory rate limiter |
| ⚠️ 8 | OSRM routing — self-host or proxy before production |
| ⚠️ 9 | Audit payout state transitions |
| ℹ️ 10 | i18n cookie SameSite flag |
