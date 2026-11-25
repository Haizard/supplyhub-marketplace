import { describe, expect, it } from "vitest";

import {
  evaluateReferral,
  QUALIFYING_DELIVERIES,
  REWARD_POINTS,
} from "@/features/partner-growth/eligibility";

const base = {
  clientVerified: true,
  relationshipActive: true,
  completedDeliveries: 60,
  paidInvoices: 2,
  isSelfReferral: false,
  isDuplicateClient: false,
  referralOwnerCompanyId: "owner",
  clientCompanyIds: ["owner"],
};

describe("Phase 9 L9 — reward eligibility", () => {
  it("rewards verified merchants with genuine completed, paid activity", () => {
    const result = evaluateReferral(base);
    expect(result.eligible).toBe(true);
    expect(result.qualifiesFor.verificationPoints).toBe(true);
    expect(result.qualifiesFor.firstDeliveryBonus).toBe(true);
    expect(result.qualifiesFor.volumeBonus).toBe(true);
  });

  it("rejects registrations without commercial activity", () => {
    const result = evaluateReferral({
      ...base,
      completedDeliveries: 0,
      paidInvoices: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("no completed delivery");
    expect(result.reasons).toContain("no genuine payment transaction");
  });

  it("rejects self-referrals and duplicate merchants regardless of activity", () => {
    expect(evaluateReferral({ ...base, isSelfReferral: true }).eligible).toBe(false);
    expect(evaluateReferral({ ...base, isDuplicateClient: true }).eligible).toBe(false);
  });

  it("does not award the volume bonus before the milestone", () => {
    const result = evaluateReferral({ ...base, completedDeliveries: QUALIFYING_DELIVERIES - 1 });
    expect(result.eligible).toBe(true);
    expect(result.qualifiesFor.volumeBonus).toBe(false);
  });

  it("uses configurable points, not cash by default", () => {
    expect(REWARD_POINTS.VERIFIED_MERCHANT).toBeGreaterThan(0);
    expect(REWARD_POINTS.FIRST_DELIVERY).toBeGreaterThan(0);
  });
});
