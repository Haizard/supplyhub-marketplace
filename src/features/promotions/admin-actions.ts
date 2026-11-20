"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { promotionInputSchema } from "@/features/promotions/validation";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { canModerateCatalog } from "@/server/auth/policies";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

const uuidSchema = z.uuid();

async function requirePromotionAdmin() {
  const actor = await getSessionActor();

  if (!actor) {
    redirect("/sign-in?next=%2Fadmin%2Fpromotions");
  }

  if (!canModerateCatalog(actor)) {
    redirect("/");
  }

  return actor;
}

export async function createPromotionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePromotionAdmin();

  const parsed = promotionInputSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    scope: formValue(formData, "scope"),
    vendorId: formValue(formData, "vendorId"),
    categoryId: formValue(formData, "categoryId"),
    percent: formValue(formData, "percent"),
    currency: formValue(formData, "currency"),
    startsAt: formValue(formData, "startsAt"),
    endsAt: formValue(formData, "endsAt"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const database = getDatabase();

  const vendorId = input.scope === "VENDOR" ? (input.vendorId ?? null) : null;
  const categoryId = input.scope === "CATEGORY" ? (input.categoryId ?? null) : null;

  if (vendorId) {
    const vendor = await database.vendor.findFirst({
      where: { id: vendorId, status: "APPROVED" },
      select: { id: true },
    });
    if (!vendor)
      return { status: "error", fieldErrors: { vendorId: "Choose an approved studio." } };
  }

  if (categoryId) {
    const category = await database.category.findFirst({
      where: { id: categoryId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!category) {
      return { status: "error", fieldErrors: { categoryId: "Choose an active department." } };
    }
  }

  try {
    await database.$transaction(async (transaction) => {
      const promotion = await transaction.promotion.create({
        data: {
          name: input.name,
          description: input.description,
          scope: input.scope,
          vendorId,
          categoryId,
          percent: input.percent,
          currency: input.currency,
          startsAt: input.startsAt ?? new Date(),
          endsAt: input.endsAt ?? null,
          createdById: actor.id,
        },
        select: { id: true, name: true },
      });

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "PROMOTION_CREATED",
        targetType: "Promotion",
        targetId: promotion.id,
        metadata: {
          name: promotion.name,
          scope: input.scope,
          percent: input.percent,
        },
      });
    });
  } catch (error) {
    logger.error("promotion.create_failed", { actorId: actor.id, error });
    return { status: "error", message: "The promotion could not be created." };
  }

  logger.info("promotion.created", { actorId: actor.id, percent: input.percent });
  revalidatePath("/admin/promotions");
  revalidatePath("/", "layout");

  return { status: "success", message: "Promotion created." };
}

export async function setPromotionActiveAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePromotionAdmin();

  const promotionId = formValue(formData, "promotionId");
  const active = formValue(formData, "active") === "1";

  if (!uuidSchema.safeParse(promotionId).success) {
    return { status: "error", message: "That promotion could not be found." };
  }

  const database = getDatabase();
  const promotion = await database.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, name: true },
  });

  if (!promotion) {
    return { status: "error", message: "That promotion could not be found." };
  }

  await database.$transaction(async (transaction) => {
    await transaction.promotion.update({ where: { id: promotion.id }, data: { isActive: active } });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: active ? "PROMOTION_ACTIVATED" : "PROMOTION_DEACTIVATED",
      targetType: "Promotion",
      targetId: promotion.id,
      metadata: { name: promotion.name },
    });
  });

  revalidatePath("/admin/promotions");
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: active ? `${promotion.name} is running.` : `${promotion.name} is paused.`,
  };
}
