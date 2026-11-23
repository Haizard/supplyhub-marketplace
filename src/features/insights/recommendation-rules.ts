import type { RecommendationCandidate, RecommendationSignals, ScoredRecommendation } from "./types";

const clampBps = (value: number) => Math.max(0, Math.min(10_000, value));

/**
 * Rule version `configurable-rules-v1`. Scores are deterministic integers
 * expressed in basis points, then converted to a three-decimal fraction.
 */
export function scoreRecommendation(
  candidate: RecommendationCandidate,
  signals: RecommendationSignals,
): ScoredRecommendation {
  const purchasedCategories = new Set(signals.purchasedCategoryIds);
  const wishlistedProducts = new Set(signals.wishlistedProductIds);
  const wishlistedCategories = new Set(signals.wishlistedCategoryIds);

  let bps = 1_000;
  let reason = "New from your catalog";

  if (wishlistedProducts.has(candidate.id)) {
    bps += 2_500;
    reason = "Already on your wishlist";
  } else if (purchasedCategories.has(candidate.categoryId)) {
    bps += 3_000;
    reason = "Similar to your past orders";

    if (wishlistedCategories.has(candidate.categoryId)) {
      bps += 1_500;
      reason = "Matches your wishlist and past orders";
    }
  } else if (wishlistedCategories.has(candidate.categoryId)) {
    bps += 1_500;
    reason = "Matches your wishlist";
  }

  bps += Math.min(100, Math.max(0, candidate.popularity)) * 20;

  if (candidate.stock > 0) {
    bps += 1_000;
  } else {
    bps -= 2_000;
  }

  const normalized = clampBps(bps);

  return {
    productId: candidate.id,
    score: Math.round(normalized / 10) / 1_000,
    reason,
  };
}

export function rankRecommendations(
  candidates: RecommendationCandidate[],
  signals: RecommendationSignals,
  limit = 6,
): ScoredRecommendation[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Recommendation limit must be between 1 and 20.");
  }

  return candidates
    .map((candidate) => scoreRecommendation(candidate, signals))
    .sort(
      (left, right) => right.score - left.score || left.productId.localeCompare(right.productId),
    )
    .slice(0, limit);
}
