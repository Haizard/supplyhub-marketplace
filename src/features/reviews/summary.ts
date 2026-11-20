export interface RatingSummary {
  count: number;
  average: number;
}

/** Average shown to one decimal place; zero when nothing has been reviewed yet. */
export function summarizeRatings(ratings: readonly number[]): RatingSummary {
  if (ratings.length === 0) {
    return { count: 0, average: 0 };
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return { count: ratings.length, average: Math.round((total / ratings.length) * 10) / 10 };
}
