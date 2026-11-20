"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { normalizeCouponCode } from "@/features/coupons/discount";
import { couponInputSchema } from "@/features/coupons/validation";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { canModerateCatalog } from "@/server/auth/policies";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

const uuidSchema = z.uuid();

async function requireCouponAdmin() {
  const actor = await getSessionActor();

  if (!actor) {
    redirect("/sign-in?next=%2Fadmin%2Fcoupons");
  }

  if (!canModerateCatalog(actor)) {
    redirect("/");
  }

  return actor;
}

export async function createCouponAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireCouponAdmin();

  const parsed = couponInputSchema.safeParse({
    code: formValue(formData, "code"),
    description: formValue(formData, "description"),
    kind: formValue(formData, "kind"),
    value: formValue(formData, "value"),
    currency: formValue(formData, "currency"),
    minSubtotal: formValue(formData, "minSubtotal"),
    maxRedemptions: formValue(formData, "maxRedemptions"),
    startsAt: formValue(formData, "startsAt"),
    endsAt: formValue(formData, "endsAt"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const database = getDatabase();

  try {
    await database.$transaction(async (transaction) => {
      const coupon = await transaction.coupon.create({
        data: {
          code: normalizeCouponCode(input.code),
          description: input.description,
          kind: input.kind,
          value: input.value,
          currency: input.currency,
          minSubtotal: input.minSubtotal ?? null,
          maxRedemptions: input.maxRedemptions ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
        },
        select: { id: true, code: true },
      });

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "COUPON_CREATED",
        targetType: "Coupon",
        targetId: coupon.id,
        metadata: { code: coupon.code, kind: input.kind, value: input.value },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", fieldErrors: { code: "That code is already in use." } };
    }

    throw error;
  }

  logger.info("COUPON_CREATED", { actorId: actor.id, code: input.code });
  revalidatePath("/admin/coupons");

  return { status: "success", message: "Discount code created." };
}

export async function setCouponActiveAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireCouponAdmin();

  const couponId = formValue(formData, "couponId");
  const active = formValue(formData, "active") === "1";

  if (!uuidSchema.safeParse(couponId).success) {
    return { status: "error", message: "That discount code could not be found." };
  }

  const database = getDatabase();
  const coupon = await database.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, code: true },
  });

  if (!coupon) {
    return { status: "error", message: "That discount code could not be found." };
  }

  await database.$transaction(async (transaction) => {
    await transaction.coupon.update({ where: { id: coupon.id }, data: { isActive: active } });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: active ? "COUPON_ACTIVATED" : "COUPON_DEACTIVATED",
      targetType: "Coupon",
      targetId: coupon.id,
      metadata: { code: coupon.code },
    });
  });

  revalidatePath("/admin/coupons");

  return {
    status: "success",
    message: active ? `${coupon.code} is active again.` : `${coupon.code} is paused.`,
  };
}
