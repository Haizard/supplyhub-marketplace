import { describe, expect, it } from "vitest";

import {
  billableSeats,
  canTransitionSubscription,
  nextBillingPeriod,
  subscriptionMonthlyTotal,
} from "@/features/subscriptions/pricing";

describe("subscription pricing", () => {
  it("only charges for seats above the included allowance", () => {
    expect(billableSeats(2, 3)).toBe(0);
    expect(billableSeats(5, 3)).toBe(2);
    expect(subscriptionMonthlyTotal("15000.00", 5, 3)).toBe("30000.00");
    expect(subscriptionMonthlyTotal("15000.00", 2, 3)).toBe("0.00");
  });

  it("clamps month-end billing periods", () => {
    const period = nextBillingPeriod(new Date("2026-01-31T10:30:00.000Z"));
    expect(period.start.toISOString()).toBe("2026-01-31T10:30:00.000Z");
    expect(period.end.toISOString()).toBe("2026-02-28T10:30:00.000Z");
  });

  it("applies the forward-only subscription state machine", () => {
    expect(canTransitionSubscription("TRIALING", "ACTIVE")).toBe(true);
    expect(canTransitionSubscription("PAST_DUE", "ACTIVE")).toBe(true);
    expect(canTransitionSubscription("ACTIVE", "TRIALING")).toBe(false);
    expect(canTransitionSubscription("CANCELLED", "ACTIVE")).toBe(false);
  });
});
