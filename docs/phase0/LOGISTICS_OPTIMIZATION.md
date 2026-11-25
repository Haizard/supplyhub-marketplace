# Logistics optimisation (Phase 9 L12)

Advisory driver ordering for company dispatch. It is **not** an autopilot: the
only job state transitions remain in `src/features/logistics-company-dispatch/`.

## Deterministic baseline (always available)

`rankBaseline()` in `src/features/logistics-optimization/baseline.ts` reuses
`scoreCompanyDriver()` from company dispatch (weights: proximity 40, rating 20,
experience 15, service area 15, availability 10) and adds a stable membership-ID
tie-breaker. Baseline output is deterministic for identical input and is always
stored on every suggestion.

The provider is opt-in and reuses the existing configuration:
`AI_INSIGHTS_PROVIDER=gemini` **and** `GEMINI_API_KEY` must both be set. No new
secret is introduced. When either is absent, the provider is never called.

## What crosses the provider boundary

Only opaque membership IDs and aggregate features: distance, rating, completed
trips, service-area flag, vehicle flag, active jobs and capacity. No names,
phone numbers, addresses, fees, customer references or credentials are sent.
The prompt is built in `buildOptimizationPrompt()` and the API key is sent in a
request header, never in the URL.

## Output contract and fallback

The model must return exactly one entry per candidate:
`{ membershipId, rank, rationale }`. `applyAiRanking()` rejects the entire AI
result — and keeps the baseline — if:

- JSON parsing or the schema fails;
- any candidate is duplicated, omitted or unknown;
- ranks are not exactly `1..N`;
- an ineligible driver (no vehicle, outside service area, or at capacity) is
  ranked above an eligible driver.

Provider timeouts, HTTP errors, empty responses and thrown errors also fall back
to the baseline. Failures are logged without keys or personal data; users see a
short note and the baseline ranking.

## Persistence and decisions

Each run creates a `LogisticsOptimizationSuggestion` with `source`
(`BASELINE`/`AI`), `status` (`PENDING`/`ACCEPTED`/`REJECTED`/`BASELINE_USED`),
the input hash, baseline ranking and saved ranking, plus an audit event
(`LOGISTICS_OPTIMIZATION_SUGGESTED`, `LOGISTICS_OPTIMIZATION_DECIDED`).
Accepting or rejecting is only a decision record on the advisory page — a human
still dispatches via the existing action. No job is assigned, reassigned or
cancelled by L12.

UI: `/logistics/[companyId]/optimize` (requires `logistics.dispatch.manage`).
Migration: `prisma/migrations/20261124230000_phase9_logistics_l12`.
Tests: `tests/unit/logistics-network-l12.test.ts` (baseline determinism, prompt
privacy, key handling, contract validation, fallback and opt-in success path).

## Configurable defaults

- Capacity per driver defaults to 3 active jobs (same as company dispatch).
- Service radius defaults to 15 km from the nearest active company branch; the
  branch distance is a documented proxy for driver proximity because driver GPS
  is not stored in this phase.
- Provider output is advisory; no weights or scores are changed by the model.
