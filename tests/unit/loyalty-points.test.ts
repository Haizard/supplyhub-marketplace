import { describe, expect, it } from "vitest";

import {
  loyaltyProgress,
  pointsForOrderTotal,
  tierForLifetimePoints,
} from "@/features/loyalty/points";

describe("loyalty points", () => {
  it("awards one point per 100 currency units, floored and capped", () => {
    expect(pointsForOrderTotal("12500.00")).toBe(125);
    expect(pointsForOrderTotal("99.99")).toBe(0);
    expect(pointsForOrderTotal("0")).toBe(0);
    expect(pointsForOrderTotal("-500")).toBe(0);
    expect(pointsForOrderTotal("5000000.00")).toBe(10_000);
  });

  it("promotes buyers through bronze, silver and gold", () => {
    expect(tierForLifetimePoints(0)).toBe("BRONZE");
    expect(tierForLifetimePoints(2999)).toBe("BRONZE");
    expect(tierForLifetimePoints(3000)).toBe("SILVER");
    expect(tierForLifetimePoints(9999)).toBe("SILVER");
    expect(tierForLifetimePoints(10_000)).toBe("GOLD");
  });

  it("reports progress toward the next tier", () => {
    expect(loyaltyProgress(0)).toMatchObject({
      tier: "BRONZE",
      nextTier: "SILVER",
      currentFloor: 0,
      target: 3000,
      remaining: 3000,
      percent: 0,
    });
    expect(loyaltyProgress(1500)).toMatchObject({ remaining: 1500, percent: 50 });
    expect(loyaltyProgress(10_000)).toMatchObject({
      tier: "GOLD",
      nextTier: null,
      percent: 100,
    });
  });
});
