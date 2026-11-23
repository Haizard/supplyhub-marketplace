import "server-only";

import { decimalToCents } from "@/features/catalog/money";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";

import { buildBusinessInsights } from "./insight-rules";
import { rankRecommendations } from "./recommendation-rules";
import type {
  BusinessInsightView,
  BusinessSignals,
  RecommendationCandidate,
  RecommendationSurface,
  RecommendationView,
} from "./types";

export type { BusinessInsightView, RecommendationProductView, RecommendationView } from "./types";

export const INSIGHTS_MODEL_VERSION = "configurable-rules-v1";
const WINDOW_DAYS = 30;
const INSIGHT_RETENTION_DAYS = 30;
const RECOMMENDATION_TTL_HOURS = 24;
const PAID_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

function windowBounds(now: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    currentStart: new Date(now.getTime() - WINDOW_DAYS * dayMs),
    previousStart: new Date(now.getTime() - 2 * WINDOW_DAYS * dayMs),
    insightCutoff: new Date(now.getTime() - INSIGHT_RETENTION_DAYS * dayMs),
    recommendationCutoff: new Date(now.getTime() - RECOMMENDATION_TTL_HOURS * 60 * 60 * 1000),
  };
}

async function loadBusinessSignals(businessId: string): Promise<BusinessSignals | null> {
  const database = getDatabase();
  const vendors = await database.vendor.findMany({
    where: { businessId },
    select: { id: true },
  });

  if (vendors.length === 0) {
    return null;
  }

  const vendorIds = vendors.map((vendor) => vendor.id);
  const now = new Date();
  const { currentStart, previousStart } = windowBounds(now);

  const [
    lowStockProducts,
    currentSales,
    previousSales,
    currentVendorOrders,
    previousVendorOrders,
    warehouseCount,
    productsWithoutStock,
    customerCount,
    recentOrders,
  ] = await Promise.all([
    database.product.findMany({
      where: { vendorId: { in: vendorIds }, status: "PUBLISHED", stock: { lte: 5 } },
      select: { id: true, name: true, stock: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    database.sale.findMany({
      where: { vendorId: { in: vendorIds }, soldAt: { gte: currentStart } },
      select: { total: true },
    }),
    database.sale.findMany({
      where: { vendorId: { in: vendorIds }, soldAt: { gte: previousStart, lt: currentStart } },
      select: { total: true },
    }),
    database.vendorOrder.findMany({
      where: {
        vendorId: { in: vendorIds },
        status: { in: [...PAID_ORDER_STATUSES] },
        createdAt: { gte: currentStart },
      },
      select: { subtotal: true },
    }),
    database.vendorOrder.findMany({
      where: {
        vendorId: { in: vendorIds },
        status: { in: [...PAID_ORDER_STATUSES] },
        createdAt: { gte: previousStart, lt: currentStart },
      },
      select: { subtotal: true },
    }),
    database.warehouse.count({ where: { vendorId: { in: vendorIds }, isActive: true } }),
    database.product.count({
      where: {
        vendorId: { in: vendorIds },
        status: "PUBLISHED",
        inventoryBalances: { none: { quantity: { gt: 0 } } },
      },
    }),
    database.customer.count({ where: { vendorId: { in: vendorIds } } }),
    database.order.findMany({
      where: {
        vendorOrders: { some: { vendorId: { in: vendorIds } } },
        status: { in: [...PAID_ORDER_STATUSES] },
        createdAt: { gte: previousStart },
      },
      select: { customerId: true },
    }),
  ]);

  const orderCounts = new Map<string, number>();
  for (const order of recentOrders) {
    orderCounts.set(order.customerId, (orderCounts.get(order.customerId) ?? 0) + 1);
  }

  let repeatCustomerCount = 0;
  for (const count of orderCounts.values()) {
    if (count > 1) {
      repeatCustomerCount += 1;
    }
  }

  const revenueLast30DaysCents =
    currentSales.reduce((sum, sale) => sum + decimalToCents(sale.total), 0) +
    currentVendorOrders.reduce((sum, order) => sum + decimalToCents(order.subtotal), 0);
  const revenuePrevious30DaysCents =
    previousSales.reduce((sum, sale) => sum + decimalToCents(sale.total), 0) +
    previousVendorOrders.reduce((sum, order) => sum + decimalToCents(order.subtotal), 0);

  return {
    businessId,
    lowStockProducts,
    revenueLast30DaysCents,
    revenuePrevious30DaysCents,
    warehouseCount,
    productsWithoutStock,
    customerCount,
    repeatCustomerCount,
  };
}

export async function generateBusinessInsights(
  businessId: string,
  actorId: string,
): Promise<BusinessInsightView[]> {
  const signals = await loadBusinessSignals(businessId);

  if (!signals) {
    return [];
  }

  const insights = buildBusinessInsights(signals);
  const now = new Date();
  const { insightCutoff } = windowBounds(now);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await getDatabase().$transaction(async (transaction) => {
    await transaction.businessAiInsight.createMany({
      data: insights.map((insight) => ({
        businessId,
        type: insight.type,
        severity: insight.severity,
        title: insight.title,
        summary: insight.summary,
        recommendation: insight.recommendation,
        confidence: insight.confidence,
        evidence: insight.evidence,
        modelVersion: INSIGHTS_MODEL_VERSION,
        generatedAt: now,
        expiresAt,
      })),
    });

    await transaction.businessAiInsight.deleteMany({
      where: { businessId, createdAt: { lt: insightCutoff } },
    });

    await recordAuditEvent(transaction, {
      actorId,
      action: "AI_INSIGHTS_GENERATED",
      targetType: "business",
      targetId: businessId,
      metadata: { count: insights.length, modelVersion: INSIGHTS_MODEL_VERSION },
    });
  });

  return getLatestBusinessInsights(businessId);
}

export async function getLatestBusinessInsights(
  businessId: string,
  limit = 8,
): Promise<BusinessInsightView[]> {
  const records = await getDatabase().businessAiInsight.findMany({
    where: { businessId },
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
    take: limit * 3,
  });

  const seen = new Set<string>();
  const unique: BusinessInsightView[] = [];

  for (const record of records) {
    if (seen.has(record.type)) {
      continue;
    }

    seen.add(record.type);
    unique.push({
      id: record.id,
      type: record.type,
      severity: record.severity,
      title: record.title,
      summary: record.summary,
      recommendation: record.recommendation,
      confidence: record.confidence,
      generatedAt: record.generatedAt,
    });

    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

async function loadCandidateProducts(userId: string): Promise<{
  candidates: RecommendationCandidate[];
  signals: {
    purchasedCategoryIds: string[];
    wishlistedProductIds: string[];
    wishlistedCategoryIds: string[];
  };
}> {
  const database = getDatabase();
  const [purchasedItems, wishlistItems] = await Promise.all([
    database.orderItem.findMany({
      where: {
        order: { customerId: userId, status: { in: [...PAID_ORDER_STATUSES] } },
        productId: { not: null },
      },
      select: {
        productId: true,
        product: { select: { categoryId: true } },
      },
    }),
    database.wishlistItem.findMany({
      where: { userId },
      select: { productId: true, product: { select: { categoryId: true } } },
    }),
  ]);

  const purchasedProductIds = purchasedItems
    .map((item) => item.productId)
    .filter((id): id is string => id !== null);
  const purchasedCategoryIds = [
    ...new Set(purchasedItems.map((item) => item.product?.categoryId).filter(Boolean)),
  ] as string[];
  const wishlistedProductIds = wishlistItems.map((item) => item.productId);
  const wishlistedCategoryIds = [...new Set(wishlistItems.map((item) => item.product.categoryId))];

  const products = await database.product.findMany({
    where: {
      status: "PUBLISHED",
      archivedAt: null,
      stock: { gt: 0 },
      id: { notIn: purchasedProductIds },
    },
    select: {
      id: true,
      categoryId: true,
      price: true,
      stock: true,
      _count: { select: { orderItems: true } },
    },
    take: 60,
  });

  return {
    candidates: products.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      priceCents: decimalToCents(product.price),
      stock: product.stock,
      popularity: Math.min(100, product._count.orderItems * 10),
    })),
    signals: { purchasedCategoryIds, wishlistedProductIds, wishlistedCategoryIds },
  };
}

export async function generateBuyerRecommendations(
  userId: string,
  surface: RecommendationSurface,
  limit = 6,
): Promise<RecommendationView[]> {
  const { candidates, signals } = await loadCandidateProducts(userId);
  const scored = rankRecommendations(candidates, signals, limit);

  if (scored.length === 0) {
    return [];
  }

  await getDatabase().$transaction(async (transaction) => {
    await transaction.aiRecommendationHistory.createMany({
      data: scored.map((item) => ({
        userId,
        productId: item.productId,
        surface,
        score: item.score.toFixed(3),
        reason: item.reason,
        modelVersion: INSIGHTS_MODEL_VERSION,
      })),
    });

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "AI_RECOMMENDATIONS_GENERATED",
      targetType: "user",
      targetId: userId,
      metadata: { count: scored.length, surface, modelVersion: INSIGHTS_MODEL_VERSION },
    });
  });

  return getBuyerRecommendations(userId, surface, limit);
}

export async function getBuyerRecommendations(
  userId: string,
  surface: RecommendationSurface,
  limit = 6,
): Promise<RecommendationView[]> {
  const records = await getDatabase().aiRecommendationHistory.findMany({
    where: { userId, surface, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    select: {
      id: true,
      reason: true,
      score: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          summary: true,
          price: true,
          currency: true,
          stock: true,
          vendor: { select: { name: true } },
          images: {
            where: { status: "APPROVED" },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { storageKey: true },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const recommendations: RecommendationView[] = [];

  for (const record of records) {
    if (seen.has(record.product.id)) {
      continue;
    }

    seen.add(record.product.id);
    recommendations.push({
      id: record.id,
      reason: record.reason,
      score: record.score?.toNumber() ?? 0,
      createdAt: record.createdAt,
      product: {
        id: record.product.id,
        name: record.product.name,
        slug: record.product.slug,
        summary: record.product.summary,
        priceCents: decimalToCents(record.product.price),
        currency: record.product.currency,
        stock: record.product.stock,
        studioName: record.product.vendor.name,
        imageKey: record.product.images[0]?.storageKey ?? null,
      },
    });

    if (recommendations.length >= limit) {
      break;
    }
  }

  return recommendations;
}

export async function ensureBuyerRecommendations(
  userId: string,
  surface: RecommendationSurface,
  limit = 6,
): Promise<RecommendationView[]> {
  const { recommendationCutoff } = windowBounds(new Date());
  const freshCount = await getDatabase().aiRecommendationHistory.count({
    where: { userId, surface, dismissedAt: null, createdAt: { gte: recommendationCutoff } },
  });

  if (freshCount >= limit) {
    return getBuyerRecommendations(userId, surface, limit);
  }

  return generateBuyerRecommendations(userId, surface, limit);
}

export async function dismissRecommendation(
  userId: string,
  recommendationId: string,
): Promise<boolean> {
  const database = getDatabase();
  const marked = await database.aiRecommendationHistory.updateMany({
    where: { id: recommendationId, userId, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });

  if (marked.count !== 1) {
    return false;
  }

  await recordAuditEvent(database, {
    actorId: userId,
    action: "AI_RECOMMENDATION_DISMISSED",
    targetType: "ai_recommendation",
    targetId: recommendationId,
  });

  return true;
}
