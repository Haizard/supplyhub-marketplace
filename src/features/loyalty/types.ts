import type { LoyaltyTier, LoyaltyTransactionType } from "@/generated/prisma/enums";

import {
  loyaltyProgress,
  REDEMPTION_POINT_COST,
  REDEMPTION_VALUE,
  type LoyaltyProgress,
} from "./points";

export interface LoyaltyTransactionView {
  id: string;
  type: LoyaltyTransactionType;
  points: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface LoyaltyAccountView {
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  progress: LoyaltyProgress;
  redemptionPointCost: number;
  redemptionValue: number;
  transactions: LoyaltyTransactionView[];
}

export function emptyLoyaltyAccountView(userId: string): LoyaltyAccountView {
  return {
    userId,
    pointsBalance: 0,
    lifetimePoints: 0,
    tier: "BRONZE",
    progress: loyaltyProgress(0),
    redemptionPointCost: REDEMPTION_POINT_COST,
    redemptionValue: REDEMPTION_VALUE,
    transactions: [],
  };
}
