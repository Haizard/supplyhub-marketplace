"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging/logger";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { redeemLoyaltyReward } from "./service";

export type RedeemLoyaltyResult = { ok: true; code: string } | { ok: false; error: string };

export async function redeemLoyaltyRewardAction(): Promise<RedeemLoyaltyResult> {
  const actor = await requireActor("/account/loyalty");

  try {
    const result = await getDatabase().$transaction((transaction) =>
      redeemLoyaltyReward(transaction, actor.id),
    );

    if (result.ok) {
      revalidatePath("/account/loyalty");
      revalidatePath("/account");
    }

    return result;
  } catch (error) {
    logger.error("loyalty.redeem_failed", { actorId: actor.id, error });
    return { ok: false, error: "The reward could not be redeemed. Please try again." };
  }
}
