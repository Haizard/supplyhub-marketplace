import { describe, expect, it } from "vitest";

import {
  calculateDriverEarning,
  calculateSettlementNet,
  payoutEligibility,
} from "@/features/logistics-finance/calculation";

const rule = {
  mode: "PER_DELIVERY" as const,
  fixedAmount: null,
  perDelivery: "3500",
  rateBps: null,
  dailyAmount: null,
};

describe("Phase 9 L7 — driver compensation", () => {
  it("computes per-delivery earnings from stored terms", () => {
    expect(calculateDriverEarning(rule, { deliveryFee: 5000, deliveries: 5, days: 1 })).toBe(
      "17500.00",
    );
  });

  it("computes percentage earnings from basis points", () => {
    expect(
      calculateDriverEarning(
        { ...rule, mode: "PERCENTAGE", rateBps: 7000 },
        { deliveryFee: 5000, deliveries: 1, days: 1 },
      ),
    ).toBe("3500.00");
  });

  it("adds fixed, per-delivery and percentage components in hybrid mode", () => {
    expect(
      calculateDriverEarning(
        { ...rule, mode: "HYBRID", fixedAmount: "10000", rateBps: 1000 },
        { deliveryFee: 5000, deliveries: 2, days: 1 },
      ),
    ).toBe("17500.00");
  });
});

describe("Phase 9 L7 — settlements", () => {
  it("derives net from revenue minus fees, driver costs and expenses", () => {
    expect(
      calculateSettlementNet({
        revenue: "500000",
        platformFees: "25000",
        driverCosts: "350000",
        expenses: "30000",
      }),
    ).toBe("95000.00");
  });

  it("never allows a payout above approved unpaid earnings", () => {
    const earnings = [
      { amount: "10000", status: "APPROVED" },
      { amount: "5000", status: "PENDING" },
    ];
    expect(payoutEligibility(earnings, "0", "10000").eligible).toBe(true);
    expect(payoutEligibility(earnings, "0", "15000").eligible).toBe(false);
    expect(payoutEligibility(earnings, "10000", "1000").eligible).toBe(false);
  });
});
