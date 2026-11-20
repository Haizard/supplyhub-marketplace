import { describe, expect, it } from "vitest";

import {
  evaluatePromotions,
  isPromotionLive,
  type PromotionRule,
} from "@/features/promotions/discount";

const now = new Date("2026-11-19T12:00:00.000Z");

function rule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: "promo-1",
    name: "November making",
    scope: "MARKETPLACE",
    vendorId: null,
    categoryId: null,
    percent: 10,
    currency: "TZS",
    startsAt: new Date("2026-11-01T00:00:00.000Z"),
    endsAt: new Date("2026-12-01T00:00:00.000Z"),
    isActive: true,
    ...overrides,
  };
}

const lines = [
  { vendorId: "vendor-a", categoryId: "ceramics", lineTotalCents: 100_000 },
  { vendorId: "vendor-b", categoryId: "textiles", lineTotalCents: 50_000 },
];

describe("promotion eligibility", () => {
  it("checks the active flag and window", () => {
    expect(isPromotionLive(rule(), now)).toBe(true);
    expect(isPromotionLive(rule({ isActive: false }), now)).toBe(false);
    expect(isPromotionLive(rule({ startsAt: new Date("2026-11-20T00:00:00Z") }), now)).toBe(false);
    expect(isPromotionLive(rule({ endsAt: now }), now)).toBe(false);
  });
});

describe("automatic promotion discount", () => {
  it("takes a percentage of every line for a marketplace promotion", () => {
    expect(evaluatePromotions([rule()], lines, { currency: "TZS", now })).toEqual({
      promotionId: "promo-1",
      promotionName: "November making",
      discountCents: 15_000,
    });
  });

  it("limits vendor and category promotions to their own lines", () => {
    expect(
      evaluatePromotions([rule({ scope: "VENDOR", vendorId: "vendor-b", percent: 20 })], lines, {
        currency: "TZS",
        now,
      })?.discountCents,
    ).toBe(10_000);

    expect(
      evaluatePromotions([rule({ scope: "CATEGORY", categoryId: "ceramics", percent: 5 })], lines, {
        currency: "TZS",
        now,
      })?.discountCents,
    ).toBe(5_000);
  });

  it("never stacks: the single best discount wins", () => {
    const best = evaluatePromotions(
      [
        rule({ id: "small", name: "Small", percent: 5 }),
        rule({ id: "big", name: "Big", percent: 15 }),
      ],
      lines,
      { currency: "TZS", now },
    );

    expect(best?.promotionId).toBe("big");
    expect(best?.discountCents).toBe(22_500);
  });

  it("ignores other currencies, dead promotions, and unmatched lines", () => {
    expect(
      evaluatePromotions([rule({ currency: "USD" })], lines, { currency: "TZS", now }),
    ).toBeNull();
    expect(
      evaluatePromotions([rule({ isActive: false })], lines, { currency: "TZS", now }),
    ).toBeNull();
    expect(
      evaluatePromotions([rule({ scope: "VENDOR", vendorId: "vendor-z" })], lines, {
        currency: "TZS",
        now,
      }),
    ).toBeNull();
  });
});
