/** Minimal shape of a Prisma Decimal — keeps this module database-agnostic. */
export interface DecimalLike {
  toString(): string;
}

export interface PricingRule {
  currency: string;
  baseFee: DecimalLike;
  perKmRate: DecimalLike;
  minimumFee: DecimalLike;
  maximumFee: DecimalLike | null;
}

/**
 * Computes a delivery fee from the configurable rule. Business pricing is
 * unresolved in docs/01-product-vision.md, so this is the documented default
 * calculation, not a claim about final marketplace policy.
 */
export function calculateDeliveryFee(
  rule: PricingRule,
  distanceKm: number,
): { fee: string; currency: string } {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error("Distance must be a non-negative number.");
  }

  const base = Number(rule.baseFee.toString());
  const perKm = Number(rule.perKmRate.toString());
  const minimum = Number(rule.minimumFee.toString());
  const maximum = rule.maximumFee ? Number(rule.maximumFee.toString()) : null;

  let amount = base + perKm * distanceKm;
  amount = Math.max(amount, minimum);
  if (maximum !== null) amount = Math.min(amount, maximum);

  // Round to two decimals without floating-point drift leaking into storage.
  const fee = (Math.round(amount * 100) / 100).toFixed(2);
  return { fee, currency: rule.currency };
}
