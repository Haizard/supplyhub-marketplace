"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logger } from "@/lib/logging/logger";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

const toggleSchema = z.object({ productId: z.string().uuid() });

/**
 * Saves or removes one object for the signed-in buyer.
 *
 * The buyer always comes from the session, never the client, so one account can
 * never touch another account's saved list.
 */
export async function toggleWishlistAction(productId: string): Promise<{ saved: boolean }> {
  const actor = await requireActor("/account/wishlist");
  const parsed = toggleSchema.safeParse({ productId });

  if (!parsed.success) {
    throw new Error("That object could not be saved.");
  }

  const database = getDatabase();
  const product = await database.product.findFirst({
    where: {
      id: parsed.data.productId,
      status: "PUBLISHED",
      vendor: { status: "APPROVED" },
      category: { status: "ACTIVE" },
    },
    select: { id: true },
  });

  if (!product) {
    throw new Error("That object is no longer available.");
  }

  const existing = await database.wishlistItem.findUnique({
    where: { userId_productId: { userId: actor.id, productId: product.id } },
    select: { id: true },
  });

  if (existing) {
    await database.wishlistItem.delete({ where: { id: existing.id } });
  } else {
    await database.wishlistItem.create({
      data: { userId: actor.id, productId: product.id },
    });
  }

  revalidatePath("/account/wishlist");
  revalidatePath("/account");
  revalidatePath("/", "layout");

  logger.info("wishlist.toggled", {
    actorId: actor.id,
    productId: product.id,
    saved: !existing,
  });

  return { saved: !existing };
}
