import "server-only";

import { getProductsByIds } from "@/features/catalog/queries";
import type { ProductListing } from "@/features/catalog/types";
import { getDatabase } from "@/server/db/client";

/** Product ids this buyer has saved, for heart state on catalog cards. */
export async function getWishlistProductIds(userId: string): Promise<Set<string>> {
  const rows = await getDatabase().wishlistItem.findMany({
    where: { userId },
    select: { productId: true },
  });

  return new Set(rows.map((row) => row.productId));
}

/** The buyer's saved objects, newest first, still limited to what is on sale. */
export async function listWishlistProducts(userId: string): Promise<ProductListing[]> {
  const saved = await getDatabase().wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });

  const ids = saved.map((row) => row.productId);

  if (ids.length === 0) return [];

  const products = await getProductsByIds(ids);
  const byId = new Map(products.map((product) => [product.id, product]));

  return ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [{ ...product, saved: true }] : [];
  });
}

export async function countWishlistItems(userId: string): Promise<number> {
  return getDatabase().wishlistItem.count({ where: { userId } });
}
