import "server-only";

import { headers } from "next/headers";

import { FixedWindowRateLimiter, type RateLimitRule } from "./rate-limiter";

// Per-process only. A multi-instance deployment must move this to a shared store.
const limiter = new FixedWindowRateLimiter();

export async function getClientAddress(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || requestHeaders.get("x-real-ip") || "unknown";

  return candidate.slice(0, 45);
}

export function consumeRateLimit(key: string, rule: RateLimitRule): boolean {
  return limiter.consume(key, rule).allowed;
}

export function consumeRateLimits(entries: { key: string; rule: RateLimitRule }[]): boolean {
  let allowed = true;

  for (const entry of entries) {
    if (!consumeRateLimit(entry.key, entry.rule)) {
      allowed = false;
    }
  }

  return allowed;
}

export function resetRateLimits(): void {
  limiter.reset();
}

/** Versioned logistics API: stricter than the storefront, per API key. */
export const LOGISTICS_API_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;
export const LOGISTICS_WEBHOOK_RATE_LIMIT = { limit: 240, windowMs: 60_000 } as const;
export const SEARCH_SUGGEST_RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;
