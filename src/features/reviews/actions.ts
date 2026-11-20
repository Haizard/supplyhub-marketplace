"use server";

import { revalidatePath } from "next/cache";

import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { getReviewGate } from "@/features/reviews/queries";
import { reviewInputSchema } from "@/features/reviews/validation";
import { logger } from "@/lib/logging/logger";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

export async function saveReviewAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();

  if (!actor) {
    return { status: "error", message: "Sign in to review an object." };
  }

  const parsed = reviewInputSchema.safeParse({
    productId: formValue(formData, "productId"),
    rating: formValue(formData, "rating"),
    title: formValue(formData, "title"),
    body: formValue(formData, "body"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const database = getDatabase();
  const product = await database.product.findFirst({
    where: {
      id: input.productId,
      status: "PUBLISHED",
      vendor: { status: "APPROVED" },
      category: { status: "ACTIVE" },
    },
    select: { id: true, slug: true },
  });

  if (!product) {
    return { status: "error", message: "That object is no longer available." };
  }

  const gate = await getReviewGate(actor.id, product.id);

  if (!gate.eligible) {
    return {
      status: "error",
      message: "Reviews are open to buyers whose order reached payment for this object.",
    };
  }

  const review = await database.productReview.upsert({
    where: { productId_authorId: { productId: product.id, authorId: actor.id } },
    create: {
      productId: product.id,
      authorId: actor.id,
      orderId: gate.orderId,
      rating: input.rating,
      title: input.title,
      body: input.body,
    },
    update: {
      rating: input.rating,
      title: input.title,
      body: input.body,
    },
    select: { id: true },
  });

  revalidatePath(`/products/${product.slug}`);

  logger.info("review.saved", { actorId: actor.id, productId: product.id, reviewId: review.id });

  return {
    status: "success",
    message: gate.review ? "Review updated." : "Review published. Thank you.",
  };
}
