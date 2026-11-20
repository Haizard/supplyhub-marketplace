export type PromotionScopeValue = "MARKETPLACE" | "VENDOR" | "CATEGORY";

export interface PromotionRule {
  id: string;
  name: string;
  scope: PromotionScopeValue;
  vendorId: string | null;
  categoryId: string | null;
  percent: number;
  currency: string;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
}

export interface PromotionLine {
  vendorId: string;
  categoryId: string;
  lineTotalCents: number;
}

export interface AppliedPromotion {
  promotionId: string;
  promotionName: string;
  discountCents: number;
}

export function isPromotionLive(
  rule: Pick<PromotionRule, "isActive" | "startsAt" | "endsAt">,
  now: Date,
): boolean {
  if (!rule.isActive) return false;
  if (rule.startsAt.getTime() > now.getTime()) return false;
  if (rule.endsAt && rule.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Promotions apply automatically and never stack: the single best live promotion
 * wins. Its percentage is taken from the lines it covers, so a vendor or department
 * promotion only discounts that studio's or department's objects. The platform
 * funds the discount; studio subtotals stay whole.
 */
export function evaluatePromotions(
  rules: readonly PromotionRule[],
  lines: readonly PromotionLine[],
  context: { currency: string; now: Date },
): AppliedPromotion | null {
  let best: AppliedPromotion | null = null;

  for (const rule of rules) {
    if (rule.currency !== context.currency) continue;
    if (rule.percent < 1 || rule.percent > 90) continue;
    if (!isPromotionLive(rule, context.now)) continue;

    const eligibleCents = lines
      .filter((line) => {
        if (rule.scope === "MARKETPLACE") return true;
        if (rule.scope === "VENDOR") return line.vendorId === rule.vendorId;
        return line.categoryId === rule.categoryId;
      })
      .reduce((total, line) => total + line.lineTotalCents, 0);

    if (eligibleCents <= 0) continue;

    const discountCents = Math.min(Math.round((eligibleCents * rule.percent) / 100), eligibleCents);

    if (discountCents < 1) continue;

    if (!best || discountCents > best.discountCents) {
      best = {
        promotionId: rule.id,
        promotionName: rule.name,
        discountCents,
      };
    }
  }

  return best;
}
