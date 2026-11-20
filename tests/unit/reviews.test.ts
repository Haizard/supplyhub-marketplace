import { describe, expect, it } from "vitest";

import { summarizeRatings } from "@/features/reviews/summary";

describe("summarizeRatings", () => {
  it("returns a zero summary when there are no reviews", () => {
    expect(summarizeRatings([])).toEqual({ count: 0, average: 0 });
  });

  it("averages ratings to one decimal place", () => {
    expect(summarizeRatings([5, 4, 4])).toEqual({ count: 3, average: 4.3 });
    expect(summarizeRatings([1, 2])).toEqual({ count: 2, average: 1.5 });
  });

  it("keeps whole averages whole", () => {
    expect(summarizeRatings([5, 5])).toEqual({ count: 2, average: 5 });
  });
});
