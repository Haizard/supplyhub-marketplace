import "server-only";

import { getDatabase } from "@/server/db/client";

import { loyaltyProgress, REDEMPTION_POINT_COST, REDEMPTION_VALUE } from "./points";
import { emptyLoyaltyAccountView, type LoyaltyAccountView } from "./types";

/** Buyer-facing loyalty snapshot. A buyer without points still sees the tier path. */
export async function getLoyaltyAccountView(userId: string): Promise<LoyaltyAccountView> {
  const account = await getDatabase().loyaltyAccount.findUnique({
    where: { userId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!account) return emptyLoyaltyAccountView(userId);

  return {
    userId,
    pointsBalance: account.pointsBalance,
    lifetimePoints: account.lifetimePoints,
    tier: account.tier,
    progress: loyaltyProgress(account.lifetimePoints),
    redemptionPointCost: REDEMPTION_POINT_COST,
    redemptionValue: REDEMPTION_VALUE,
    transactions: account.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      points: transaction.points,
      balanceAfter: transaction.balanceAfter,
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
    })),
  };
}
