import "server-only";

import type { PromotionScope } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface PromotionSummary {
  id: string;
  name: string;
  description: string;
  scope: PromotionScope;
  targetName: string;
  percent: number;
  currency: string;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  orderCount: number;
}

export async function listPromotions(): Promise<PromotionSummary[]> {
  const rows = await getDatabase().promotion.findMany({
    orderBy: [{ isActive: "desc" }, { startsAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      scope: true,
      percent: true,
      currency: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      vendor: { select: { name: true } },
      category: { select: { name: true } },
      _count: { select: { orders: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    scope: row.scope,
    targetName:
      row.scope === "MARKETPLACE"
        ? "Every studio"
        : row.scope === "VENDOR"
          ? (row.vendor?.name ?? "Studio")
          : (row.category?.name ?? "Department"),
    percent: row.percent,
    currency: row.currency,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
    orderCount: row._count.orders,
  }));
}

export interface PromotionTargets {
  vendors: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

export async function listPromotionTargets(): Promise<PromotionTargets> {
  const database = getDatabase();
  const [vendors, categories] = await Promise.all([
    database.vendor.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    database.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return { vendors, categories };
}
