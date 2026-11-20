import "server-only";

import { connection } from "next/server";

import { decimalToCents } from "@/features/catalog/money";
import type { ProductStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";
import { mediaUrlForKey } from "@/server/storage/keys";

/** Order states that prove a unit left the shelf through the storefront. */
const SOLD_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** Published objects at or below this count are flagged as low stock. */
export const LOW_STOCK_THRESHOLD = 4;

export interface StudioInventoryRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: ProductStatus;
  priceCents: number;
  currency: string;
  categoryName: string;
  image: { src: string; alt: string } | null;
  optionCount: number;
  stock: number;
  /** Units at the counter's default location, when it has a balance row. */
  atDefaultLocation: number | null;
  ratingAverage: number | null;
  ratingCount: number;
  sold: number;
  updatedAt: Date;
}

export interface StudioInventory {
  rows: StudioInventoryRow[];
  locationName: string | null;
  stats: {
    active: number;
    units: number;
    lowStock: number;
    outOfStock: number;
  };
}

/**
 * The studio's whole catalog with what an inventory view needs: stock at the
 * default location, option count, rating and units sold. Scoped by vendor id,
 * and capped so one studio cannot pull an unbounded list.
 */
export async function listStudioInventory(vendorId: string): Promise<StudioInventory> {
  await connection();

  const database = getDatabase();
  const defaultWarehouse = await database.warehouse.findFirst({
    where: { vendorId, isDefault: true },
    select: { id: true, name: true },
  });

  const products = await database.product.findMany({
    where: { vendorId },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      status: true,
      price: true,
      currency: true,
      stock: true,
      updatedAt: true,
      category: { select: { name: true } },
      images: {
        where: { status: "APPROVED" },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { storageKey: true, alt: true },
      },
      _count: { select: { variants: true } },
      inventoryBalances: {
        where: { warehouseId: defaultWarehouse?.id ?? "00000000-0000-0000-0000-000000000000" },
        select: { quantity: true },
        take: 1,
      },
    },
  });

  if (products.length === 0) {
    return {
      rows: [],
      locationName: defaultWarehouse?.name ?? null,
      stats: { active: 0, units: 0, lowStock: 0, outOfStock: 0 },
    };
  }

  const productIds = products.map((product) => product.id);

  const [ratings, storefrontSales, counterSales] = await Promise.all([
    database.productReview.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
      _count: true,
    }),
    database.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        order: { status: { in: [...SOLD_ORDER_STATUSES] } },
      },
      _sum: { quantity: true },
    }),
    database.saleItem.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, sale: { vendorId } },
      _sum: { quantity: true },
    }),
  ]);

  const ratingsByProduct = new Map(
    ratings
      .filter((entry) => entry.productId !== null)
      .map((entry) => [
        entry.productId as string,
        { average: entry._avg.rating, count: entry._count },
      ]),
  );

  const soldByProduct = new Map<string, number>();
  for (const entry of [...storefrontSales, ...counterSales]) {
    if (entry.productId === null) continue;
    soldByProduct.set(
      entry.productId,
      (soldByProduct.get(entry.productId) ?? 0) + (entry._sum.quantity ?? 0),
    );
  }

  const rows = products.map((product) => {
    const rating = ratingsByProduct.get(product.id);
    const image = product.images[0];

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      status: product.status,
      priceCents: decimalToCents(product.price),
      currency: product.currency,
      categoryName: product.category.name,
      image: image ? { src: mediaUrlForKey(image.storageKey), alt: image.alt } : null,
      optionCount: product._count.variants,
      stock: product.stock,
      atDefaultLocation: product.inventoryBalances[0]?.quantity ?? null,
      ratingAverage: rating?.average ?? null,
      ratingCount: rating?.count ?? 0,
      sold: soldByProduct.get(product.id) ?? 0,
      updatedAt: product.updatedAt,
    };
  });

  const active = rows.filter((row) => row.status === "PUBLISHED");
  const units = rows.reduce((total, row) => total + row.stock, 0);

  return {
    rows,
    locationName: defaultWarehouse?.name ?? null,
    stats: {
      active: active.length,
      units,
      lowStock: active.filter((row) => row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD).length,
      outOfStock: active.filter((row) => row.stock <= 0).length,
    },
  };
}
