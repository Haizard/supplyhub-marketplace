import "server-only";

import { summarizeRatings, type RatingSummary } from "@/features/reviews/summary";
import { getDatabase } from "@/server/db/client";

/** Order states that prove the buyer actually bought the object. */
const PURCHASED_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export interface ProductReviewView {
  id: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewGate {
  /** True when this buyer has a purchased order item for the object. */
  eligible: boolean;
  orderId: string | null;
  review: {
    id: string;
    rating: number;
    title: string;
    body: string;
  } | null;
}

export async function getProductRatingSummary(productId: string): Promise<RatingSummary> {
  const database = getDatabase();
  const ratings = await database.productReview.findMany({
    where: { productId },
    select: { rating: true },
  });

  return summarizeRatings(ratings.map((row) => row.rating));
}

export async function listProductReviews(
  productId: string,
  limit = 12,
): Promise<ProductReviewView[]> {
  const database = getDatabase();
  const reviews = await database.productReview.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true } },
    },
  });

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    authorId: review.authorId,
    authorName: review.author.name,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }));
}

/**
 * Resolves whether the buyer may review this object. The purchase lookup is
 * scoped to the session user and to orders that reached payment, so a buyer
 * cannot review something they never bought, and cannot borrow another
 * account's order.
 */
export async function getReviewGate(userId: string | null, productId: string): Promise<ReviewGate> {
  if (!userId) {
    return { eligible: false, orderId: null, review: null };
  }

  const database = getDatabase();
  const [existingReview, purchase] = await Promise.all([
    database.productReview.findUnique({
      where: { productId_authorId: { productId, authorId: userId } },
      select: { id: true, rating: true, title: true, body: true },
    }),
    database.orderItem.findFirst({
      where: {
        productId,
        order: {
          customerId: userId,
          status: { in: [...PURCHASED_STATUSES] },
        },
      },
      orderBy: { order: { createdAt: "desc" } },
      select: { orderId: true },
    }),
  ]);

  return {
    eligible: Boolean(purchase) || existingReview !== null,
    orderId: purchase?.orderId ?? null,
    review: existingReview,
  };
}
