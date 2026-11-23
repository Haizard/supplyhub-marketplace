"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActor } from "@/server/auth/guards";
import {
  BusinessAccessError,
  hasPermission,
  resolveBusinessContext,
} from "@/server/business/context";
import { AUTH_RATE_LIMITS } from "@/server/security/auth-rate-limits";
import { consumeRateLimit } from "@/server/security/rate-limit";

import {
  dismissRecommendation,
  generateBusinessInsights,
  generateBuyerRecommendations,
} from "./service";

export type InsightActionResult = { ok: boolean; message: string };

const businessInputSchema = z.object({ businessId: z.uuid() });
const surfaceSchema = z.enum(["HOME", "CATALOG", "ACCOUNT"]);
const recommendationIdSchema = z.uuid();

export async function refreshBusinessInsightsAction(input: {
  businessId: string;
}): Promise<InsightActionResult> {
  const actor = await requireActor(`/business/${input.businessId}/insights`);
  const parsed = businessInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "That business reference is invalid." };
  }

  if (!consumeRateLimit(`insights:refresh:${actor.id}`, AUTH_RATE_LIMITS.insightsByUser)) {
    return { ok: false, message: "Too many insight refreshes. Wait a few minutes." };
  }

  let context;
  try {
    context = await resolveBusinessContext(actor, parsed.data.businessId);
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { ok: false, message: "You cannot view insights for this business." };
    }
    throw error;
  }

  if (!hasPermission(context, "insights.read")) {
    return { ok: false, message: "Your business role does not include insight access." };
  }

  await generateBusinessInsights(parsed.data.businessId, actor.id);
  revalidatePath(`/business/${parsed.data.businessId}/insights`);
  revalidatePath(`/business/${parsed.data.businessId}`);

  return { ok: true, message: "Insights refreshed from current business data." };
}

export async function refreshBuyerRecommendationsAction(
  surface: string,
): Promise<InsightActionResult> {
  const actor = await requireActor("/recommendations");
  const parsed = surfaceSchema.safeParse(surface);

  if (!parsed.success) {
    return { ok: false, message: "That recommendation surface is invalid." };
  }

  if (
    !consumeRateLimit(`recommendations:refresh:${actor.id}`, AUTH_RATE_LIMITS.recommendationsByUser)
  ) {
    return { ok: false, message: "Too many recommendation refreshes. Wait a few minutes." };
  }

  await generateBuyerRecommendations(actor.id, parsed.data);
  revalidatePath("/recommendations");
  revalidatePath("/account");

  return { ok: true, message: "Recommendations refreshed." };
}

export async function dismissRecommendationAction(id: string): Promise<InsightActionResult> {
  const actor = await requireActor("/recommendations");
  const parsed = recommendationIdSchema.safeParse(id);

  if (!parsed.success) {
    return { ok: false, message: "That recommendation reference is invalid." };
  }

  if (
    !consumeRateLimit(`recommendations:dismiss:${actor.id}`, AUTH_RATE_LIMITS.recommendationsByUser)
  ) {
    return { ok: false, message: "Too many attempts. Wait a few minutes." };
  }

  if (!(await dismissRecommendation(actor.id, parsed.data))) {
    return { ok: false, message: "That recommendation is no longer available." };
  }

  revalidatePath("/recommendations");
  return { ok: true, message: "Recommendation dismissed." };
}
