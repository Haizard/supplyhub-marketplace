import { Prisma } from "@/generated/prisma/client";
import type { PricingMode } from "@/generated/prisma/enums";

export interface PricedDelivery {
  mode: PricingMode;
  perDelivery?: string;
  monthlyFee?: string;
  perKmRate?: string;
  minimumFee?: string;
  includedUnits?: number | null;
  tierJson?: Prisma.JsonValue;
}

/** Contract pricing arithmetic in integer cents; no floating point reaches storage. */
export function calculateDeliveryCharge(
  pricing: PricedDelivery,
  input: { deliveriesInPeriod: number; distanceKm?: number },
): string {
  const cents = (value?: string) => {
    if (!value) return 0;
    const [major, minor = ""] = value.split(".");
    return Number(major) * 100 + Number((minor + "00").slice(0, 2));
  };

  let amount = 0;
  switch (pricing.mode) {
    case "PER_DELIVERY":
      amount = cents(pricing.perDelivery);
      break;
    case "FLAT_MONTHLY":
      amount =
        input.deliveriesInPeriod > (pricing.includedUnits ?? 0) ? cents(pricing.perDelivery) : 0;
      break;
    case "TIERED_VOLUME": {
      const tiers = Array.isArray(pricing.tierJson) ? pricing.tierJson : [];
      const matched = tiers.find((tier) => {
        if (!tier || typeof tier !== "object") return false;
        const record = tier as Record<string, unknown>;
        const min = Number(record.minQuantity ?? 0);
        const max = record.maxQuantity === null ? Infinity : Number(record.maxQuantity ?? Infinity);
        return input.deliveriesInPeriod >= min && input.deliveriesInPeriod <= max;
      }) as Record<string, unknown> | undefined;
      amount = matched ? cents(String(matched.unitPrice ?? "")) : cents(pricing.perDelivery);
      break;
    }
    case "PER_KM":
      amount = cents(pricing.perKmRate) * Math.max(0, input.distanceKm ?? 0);
      break;
  }

  const minimum = cents(pricing.minimumFee);
  return new Prisma.Decimal(Math.max(amount, minimum) / 100).toFixed(2);
}

export function contractProgress(
  delivered: number,
  allocation: number | null,
): { remaining: number | null; percent: number } {
  if (allocation === null || allocation <= 0) {
    return { remaining: null, percent: 0 };
  }
  const remaining = Math.max(0, allocation - delivered);
  return { remaining, percent: Math.min(100, Math.round((delivered / allocation) * 100)) };
}

export function isExpiringSoon(endsAt: string | null, now = new Date(), days = 7): boolean {
  if (!endsAt) return false;
  const end = new Date(endsAt).getTime();
  return end > now.getTime() && end - now.getTime() <= days * 24 * 60 * 60 * 1000;
}
