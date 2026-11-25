import { describe, expect, it } from "vitest";

import {
  calculateDeliveryCharge,
  contractProgress,
  isExpiringSoon,
} from "@/features/logistics-contracts/pricing";
import { canTransitionContract, canTransitionInvoice } from "@/features/logistics-contracts/status";
import { contractSchema } from "@/features/logistics-contracts/validation";

const companyId = "00000000-0000-4000-8000-000000000001";
const clientId = "00000000-0000-4000-8000-000000000002";

describe("Phase 9 L5 — contract lifecycle", () => {
  it("allows activation and suspension but blocks transitions from terminal states", () => {
    expect(canTransitionContract("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionContract("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransitionContract("SUSPENDED", "ACTIVE")).toBe(true);
    expect(canTransitionContract("TERMINATED", "ACTIVE")).toBe(false);
    expect(canTransitionContract("EXPIRED", "DRAFT")).toBe(false);
  });

  it("moves invoices forward only", () => {
    expect(canTransitionInvoice("DRAFT", "ISSUED")).toBe(true);
    expect(canTransitionInvoice("ISSUED", "PAID")).toBe(true);
    expect(canTransitionInvoice("PAID", "ISSUED")).toBe(false);
  });
});

describe("Phase 9 L5 — pricing arithmetic", () => {
  it("uses integer cents for per-delivery charges", () => {
    expect(
      calculateDeliveryCharge(
        { mode: "PER_DELIVERY", perDelivery: "5000" },
        { deliveriesInPeriod: 1 },
      ),
    ).toBe("5000.00");
  });

  it("applies a minimum fee to per-km pricing", () => {
    expect(
      calculateDeliveryCharge(
        { mode: "PER_KM", perKmRate: "2000", minimumFee: "5000" },
        { deliveriesInPeriod: 1, distanceKm: 1 },
      ),
    ).toBe("5000.00");
  });

  it("reports remaining allocation and expiry", () => {
    expect(contractProgress(145, 200)).toEqual({ remaining: 55, percent: 73 });
    expect(isExpiringSoon(new Date(Date.now() + 3 * 86400000).toISOString())).toBe(true);
    expect(isExpiringSoon(new Date(Date.now() + 30 * 86400000).toISOString())).toBe(false);
  });
});

describe("Phase 9 L5 — validation", () => {
  const base = {
    companyId,
    clientId,
    type: "MONTHLY",
    title: "Arusha electronics monthly",
    currency: "TZS",
    startsAt: "2026-12-01",
    mode: "PER_DELIVERY",
    perDelivery: "5000",
    proofRequired: "on",
    otpRequired: "on",
  };

  it("accepts a complete contract", () => {
    expect(contractSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an end date before the start", () => {
    expect(contractSchema.safeParse({ ...base, endsAt: "2026-11-01" }).success).toBe(false);
  });
});
