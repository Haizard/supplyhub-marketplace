import { describe, expect, it } from "vitest";

import { rankCompanyOffers, scoreCompanyOffer } from "@/features/logistics-marketplace/scoring";

const base = {
  companyId: "00000000-0000-4000-8000-000000000001",
  verified: true,
  active: true,
  coverageKm: 30,
  distanceKm: 5,
  capacityCount: 3,
  vehicleMatch: true,
  reliabilityBps: 9000,
  priceScoreBps: 8000,
};

describe("Phase 9 L8 — marketplace eligibility", () => {
  it("requires verification, coverage, capacity and a matching vehicle", () => {
    expect(scoreCompanyOffer(base).eligible).toBe(true);
    expect(scoreCompanyOffer({ ...base, verified: false }).eligible).toBe(false);
    expect(scoreCompanyOffer({ ...base, active: false }).eligible).toBe(false);
    expect(scoreCompanyOffer({ ...base, coverageKm: null }).eligible).toBe(false);
    expect(scoreCompanyOffer({ ...base, distanceKm: 40 }).eligible).toBe(false);
    expect(scoreCompanyOffer({ ...base, capacityCount: 0 }).eligible).toBe(false);
    expect(scoreCompanyOffer({ ...base, vehicleMatch: false }).eligible).toBe(false);
  });

  it("never ranks an unverified company, even with a perfect score", () => {
    const ranked = rankCompanyOffers([
      { ...base, companyId: "unverified", verified: false, reliabilityBps: 10000 },
      { ...base, companyId: "verified", reliabilityBps: 5000 },
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.companyId).toBe("verified");
    expect(ranked[0]?.companyId).toBe("verified");
  });

  it("sorts eligible companies by score descending", () => {
    const ranked = rankCompanyOffers([
      { ...base, companyId: "low", reliabilityBps: 5000 },
      { ...base, companyId: "high", reliabilityBps: 9500 },
    ]);
    expect(ranked[0]?.companyId).toBe("high");
  });
});
