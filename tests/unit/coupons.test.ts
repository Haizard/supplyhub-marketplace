import { describe, expect, it } from "vitest";

import { evaluateCoupon, normalizeCouponCode, type CouponRule } from "@/features/coupons/discount";

const now = new Date("2026-11-19T10:00:00.000Z");

function rule(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    isActive: true,
    startsAt: null,
    endsAt: null,
    minSubtotalCents: null,
    maxRedemptions: null,
    redemptions: 0,
    kind: "PERCENT",
    percent: 10,
    amountCents: null,
    currency: "TZS",
    ...overrides,
  };
}

describe("normalizeCouponCode", () => {
  it("trims, removes spaces, and upper-cases the code", () => {
    expect(normalizeCouponCode("  hello 2026 ")).toBe("HELLO2026");
  });
});

describe("evaluateCoupon", () => {
  it("takes a percentage of the subtotal, rounded to the nearest cent", () => {
    expect(evaluateCoupon(rule(), { subtotalCents: 185_000, currency: "TZS", now })).toEqual({
      ok: true,
      discountCents: 18_500,
    });
    expect(
      evaluateCoupon(rule({ percent: 12.5 }), {
        subtotalCents: 18_501,
        currency: "TZS",
        now,
      }),
    ).toEqual({ ok: true, discountCents: 2313 });
  });

  it("caps the discount at the subtotal", () => {
    expect(
      evaluateCoupon(rule({ kind: "FIXED", percent: null, amountCents: 500_000 }), {
        subtotalCents: 185_000,
        currency: "TZS",
        now,
      }),
    ).toEqual({ ok: true, discountCents: 185_000 });
  });

  it("rejects inactive, not-started, and expired coupons", () => {
    expect(
      evaluateCoupon(rule({ isActive: false }), { subtotalCents: 100_000, currency: "TZS", now }),
    ).toEqual({ ok: false, reason: "inactive" });
    expect(
      evaluateCoupon(rule({ startsAt: new Date("2026-11-20T00:00:00.000Z") }), {
        subtotalCents: 100_000,
        currency: "TZS",
        now,
      }),
    ).toEqual({ ok: false, reason: "not-started" });
    expect(
      evaluateCoupon(rule({ endsAt: now }), { subtotalCents: 100_000, currency: "TZS", now }),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects exhausted coupons and subtotals below the minimum", () => {
    expect(
      evaluateCoupon(rule({ maxRedemptions: 5, redemptions: 5 }), {
        subtotalCents: 100_000,
        currency: "TZS",
        now,
      }),
    ).toEqual({ ok: false, reason: "exhausted" });
    expect(
      evaluateCoupon(rule({ minSubtotalCents: 200_000 }), {
        subtotalCents: 185_000,
        currency: "TZS",
        now,
      }),
    ).toEqual({ ok: false, reason: "min-subtotal" });
  });

  it("rejects a coupon priced in another currency", () => {
    expect(
      evaluateCoupon(rule({ currency: "USD" }), {
        subtotalCents: 100_000,
        currency: "TZS",
        now,
      }),
    ).toEqual({ ok: false, reason: "currency" });
  });

  it("rejects impossible coupon values", () => {
    expect(
      evaluateCoupon(rule({ percent: 0 }), { subtotalCents: 100_000, currency: "TZS", now }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      evaluateCoupon(rule({ percent: 120 }), { subtotalCents: 100_000, currency: "TZS", now }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      evaluateCoupon(rule({ kind: "FIXED", percent: null, amountCents: 0 }), {
        subtotalCents: 100_000,
        currency: "TZS",
        now,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});
