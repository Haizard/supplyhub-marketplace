"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logger } from "@/lib/logging/logger";
import { getSessionActor } from "@/server/auth/session";
import { ACTIVE_BUSINESS_COOKIE } from "@/server/business/active-business";
import { getDatabase } from "@/server/db/client";

const switchSchema = z.object({
  businessId: z.uuid(),
});

function activeBusinessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Switches the business the signed-in member is acting as.
 *
 * The membership is re-checked here before the cookie is written, and the
 * session re-reads memberships on every request, so an invalid or withdrawn
 * membership can never become active.
 */
export async function switchActiveBusinessAction(formData: FormData): Promise<void> {
  const actor = await getSessionActor();

  if (!actor) {
    redirect("/sign-in?next=%2Fvendor");
  }

  const parsed = switchSchema.safeParse({ businessId: formData.get("businessId") });

  if (!parsed.success) {
    redirect("/vendor");
  }

  const membership = await getDatabase().businessMember.findFirst({
    where: { userId: actor.id, businessId: parsed.data.businessId, status: "active" },
    select: { id: true },
  });

  if (!membership) {
    redirect("/account?denied=studio");
  }

  (await cookies()).set(
    ACTIVE_BUSINESS_COOKIE,
    parsed.data.businessId,
    activeBusinessCookieOptions(),
  );

  logger.info("business.active_changed", {
    actorId: actor.id,
    businessId: parsed.data.businessId,
  });

  revalidatePath("/vendor", "layout");
  redirect("/vendor");
}
