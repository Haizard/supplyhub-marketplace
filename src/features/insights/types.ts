export type InsightType =
  | "LOW_STOCK"
  | "REVENUE_TREND"
  | "INVENTORY_IMBALANCE"
  | "CUSTOMER_RETENTION"
  | "RECOMMENDED_RESTOCK";

export type InsightSeverity = "INFO" | "OPPORTUNITY" | "WARNING";

export type RecommendationSurface = "HOME" | "CATALOG" | "ACCOUNT";

export type InsightEvidence = Record<string, string | number | string[]>;

export interface BusinessSignals {
  businessId: string;
  lowStockProducts: { id: string; name: string; stock: number }[];
  revenueLast30DaysCents: number;
  revenuePrevious30DaysCents: number;
  warehouseCount: number;
  productsWithoutStock: number;
  customerCount: number;
  repeatCustomerCount: number;
}

export interface GeneratedInsight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  summary: string;
  recommendation: string;
  confidence: number;
  evidence: InsightEvidence;
}

export interface RecommendationCandidate {
  id: string;
  categoryId: string;
  priceCents: number;
  stock: number;
  popularity: number;
}

export interface RecommendationSignals {
  purchasedCategoryIds: string[];
  wishlistedProductIds: string[];
  wishlistedCategoryIds: string[];
}

export interface ScoredRecommendation {
  productId: string;
  score: number;
  reason: string;
}

export type BusinessInsightView = {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  summary: string;
  recommendation: string;
  confidence: number;
  generatedAt: Date;
};

export type RecommendationProductView = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  priceCents: number;
  currency: string;
  stock: number;
  studioName: string;
  imageKey: string | null;
};

export type RecommendationView = {
  id: string;
  reason: string;
  score: number;
  createdAt: Date;
  product: RecommendationProductView;
};
