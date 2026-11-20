export type CouponKindValue = "PERCENT" | "FIXED";

export type CouponRejection =
  "invalid" | "inactive" | "not-started" | "expired" | "exhausted" | "min-subtotal" | "currency";

export interface CouponRule {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  minSubtotalCents: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  kind: CouponKindValue;
  /** 0–100 for a percentage coupon, otherwise null. */
  percent: number | null;
  /** Amount in the coupon currency for a fixed coupon, otherwise null. */
  amountCents: number | null;
  currency: string;
}

export type CouponEvaluation =
  { ok: true; discountCents: number } | { ok: false; reason: CouponRejection };

export function normalizeCouponCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Pure coupon eligibility and discount math, so checkout and tests agree.
 * Percentages round to the nearest cent and never exceed the order subtotal.
 */
export function evaluateCoupon(
  rule: CouponRule,
  context: { subtotalCents: number; currency: string; now: Date },
): CouponEvaluation {
  if (!Number.isInteger(context.subtotalCents) || context.subtotalCents <= 0) {
    return { ok: false, reason: "invalid" };
  }

  if (rule.currency !== context.currency) {
    return { ok: false, reason: "currency" };
  }

  if (!rule.isActive) {
    return { ok: false, reason: "inactive" };
  }

  if (rule.startsAt && rule.startsAt.getTime() > context.now.getTime()) {
    return { ok: false, reason: "not-started" };
  }

  if (rule.endsAt && rule.endsAt.getTime() <= context.now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (rule.maxRedemptions !== null && rule.redemptions >= rule.maxRedemptions) {
    return { ok: false, reason: "exhausted" };
  }

  if (rule.minSubtotalCents !== null && context.subtotalCents < rule.minSubtotalCents) {
    return { ok: false, reason: "min-subtotal" };
  }

  let discountCents: number;

  if (rule.kind === "PERCENT") {
    if (rule.percent === null || !Number.isFinite(rule.percent) || rule.percent <= 0) {
      return { ok: false, reason: "invalid" };
    }
    if (rule.percent > 100) {
      return { ok: false, reason: "invalid" };
    }
    discountCents = Math.round((context.subtotalCents * rule.percent) / 100);
  } else {
    if (rule.amountCents === null || !Number.isInteger(rule.amountCents) || rule.amountCents <= 0) {
      return { ok: false, reason: "invalid" };
    }
    discountCents = rule.amountCents;
  }

  return { ok: true, discountCents: Math.min(discountCents, context.subtotalCents) };
}
