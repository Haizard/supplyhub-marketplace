import { describe, expect, it } from "vitest";

import { buildBusinessInsights } from "@/features/insights/insight-rules";
import { rankRecommendations, scoreRecommendation } from "@/features/insights/recommendation-rules";
import type { BusinessSignals, RecommendationCandidate } from "@/features/insights/types";

const baseSignals: BusinessSignals = {
  businessId: "11111111-1111-4111-8111-111111111111",
  lowStockProducts: [{ id: "p1", name: "Kiln cup", stock: 2 }],
  revenueLast30DaysCents: 1_200_000,
  revenuePrevious30DaysCents: 1_000_000,
  warehouseCount: 2,
  productsWithoutStock: 3,
  customerCount: 10,
  repeatCustomerCount: 1,
};

const candidate: RecommendationCandidate = {
  id: "22222222-2222-4222-8222-222222222222",
  categoryId: "33333333-3333-4333-8333-333333333333",
  priceCents: 25_000,
  stock: 8,
  popularity: 50,
};

describe("business insight rules", () => {
  it("generates every threshold signal from first-party data", () => {
    const insights = buildBusinessInsights(baseSignals);
    const types = insights.map((insight) => insight.type);

    expect(types).toEqual([
      "LOW_STOCK",
      "REVENUE_TREND",
      "INVENTORY_IMBALANCE",
      "CUSTOMER_RETENTION",
    ]);
    expect(insights[0]?.severity).toBe("WARNING");
    expect(insights[1]?.severity).toBe("OPPORTUNITY");
    expect(insights[1]?.evidence).toMatchObject({ changeBps: 2_000 });
    expect(insights[3]?.evidence).toMatchObject({ repeatRateBps: 1_000 });
  });

  it("returns a stable informational snapshot when no threshold is crossed", () => {
    const insights = buildBusinessInsights({
      ...baseSignals,
      lowStockProducts: [],
      revenueLast30DaysCents: 1_000_000,
      revenuePrevious30DaysCents: 1_000_000,
      warehouseCount: 1,
      productsWithoutStock: 0,
      repeatCustomerCount: 8,
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({ type: "RECOMMENDED_RESTOCK", severity: "INFO" });
  });
});

describe("recommendation rules", () => {
  it("scores exact wishlist matches above category-only matches", () => {
    const wishlisted = scoreRecommendation(candidate, {
      purchasedCategoryIds: [],
      wishlistedProductIds: [candidate.id],
      wishlistedCategoryIds: [candidate.categoryId],
    });
    const categoryOnly = scoreRecommendation(candidate, {
      purchasedCategoryIds: [],
      wishlistedProductIds: [],
      wishlistedCategoryIds: [candidate.categoryId],
    });

    expect(wishlisted.score).toBeGreaterThan(categoryOnly.score);
    expect(wishlisted.reason).toBe("Already on your wishlist");
  });

  it("ranks deterministically and clamps scores to the valid range", () => {
    const second = { ...candidate, id: "44444444-4444-4444-8444-444444444444" };
    const signals = {
      purchasedCategoryIds: [candidate.categoryId],
      wishlistedProductIds: [],
      wishlistedCategoryIds: [],
    };

    const ranked = rankRecommendations([candidate, second], signals, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((item) => item.score >= 0 && item.score <= 1)).toBe(true);
    expect(rankRecommendations([candidate, second], signals, 2)).toEqual(ranked);
  });
});
