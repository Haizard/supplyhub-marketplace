import type { LoyaltyTier } from "@/generated/prisma/enums";

/** 1 point for every 100 currency units paid. */
export const CURRENCY_UNITS_PER_POINT = 100;
/** 500 points unlocks a 5,000 TZS checkout coupon. */
export const REDEMPTION_POINT_COST = 500;
export const REDEMPTION_VALUE = 5000;
export const REDEMPTION_CURRENCY = "TZS";

const MAX_ORDER_POINTS = 10_000;

export interface LoyaltyProgress {
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  currentFloor: number;
  target: number | null;
  remaining: number | null;
  percent: number;
}

const TIER_FLOORS: readonly { tier: LoyaltyTier; floor: number }[] = [
  { tier: "BRONZE", floor: 0 },
  { tier: "SILVER", floor: 3000 },
  { tier: "GOLD", floor: 10_000 },
];

/** Decimal-safe enough for loyalty: a decimal string is parsed once, then floored. */
export function pointsForOrderTotal(total: { toString(): string } | number | string): number {
  const value = Number(typeof total === "object" ? total.toString() : total);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_ORDER_POINTS, Math.floor(value / CURRENCY_UNITS_PER_POINT));
}

export function tierForLifetimePoints(lifetimePoints: number): LoyaltyTier {
  let tier: LoyaltyTier = "BRONZE";
  for (const entry of TIER_FLOORS) {
    if (lifetimePoints >= entry.floor) tier = entry.tier;
  }
  return tier;
}

export function loyaltyProgress(lifetimePoints: number): LoyaltyProgress {
  const tier = tierForLifetimePoints(lifetimePoints);
  const index = TIER_FLOORS.findIndex((entry) => entry.tier === tier);
  const current = TIER_FLOORS[index]!;
  const next = TIER_FLOORS[index + 1] ?? null;

  if (!next) {
    return {
      tier,
      nextTier: null,
      currentFloor: current.floor,
      target: null,
      remaining: null,
      percent: 100,
    };
  }

  const span = next.floor - current.floor;
  const earned = Math.max(0, Math.min(span, lifetimePoints - current.floor));

  return {
    tier,
    nextTier: next.tier,
    currentFloor: current.floor,
    target: next.floor,
    remaining: next.floor - lifetimePoints,
    percent: Math.round((earned / span) * 100),
  };
}
