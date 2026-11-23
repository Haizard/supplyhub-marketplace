import { describe, expect, it } from "vitest";

import { isValidFeatureFlagKey, normalizeFeatureFlagKey } from "@/features/flags/key";
import { MAX_OUTBOX_ATTEMPTS, nextAttemptDelayMs } from "@/features/outbox/backoff";

describe("Phase 7 foundations", () => {
  it("normalizes and validates feature flag keys", () => {
    expect(normalizeFeatureFlagKey("  Phase7.Services_Marketplace ")).toBe(
      "phase7.services_marketplace",
    );
    expect(isValidFeatureFlagKey("phase7.group-buying")).toBe(true);
    expect(isValidFeatureFlagKey("Bad Key")).toBe(false);
    expect(isValidFeatureFlagKey("ab")).toBe(false);
  });

  it("uses capped exponential outbox backoff", () => {
    expect(nextAttemptDelayMs(1)).toBe(1_000);
    expect(nextAttemptDelayMs(2)).toBe(2_000);
    expect(nextAttemptDelayMs(3)).toBe(4_000);
    expect(nextAttemptDelayMs(MAX_OUTBOX_ATTEMPTS)).toBe(16_000);
    expect(nextAttemptDelayMs(99)).toBe(60 * 60 * 1000);
  });
});
