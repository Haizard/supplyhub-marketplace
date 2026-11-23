"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireAdmin } from "@/server/auth/guards";
import { requireBusinessAccess } from "@/features/b2b/access";
import { getDatabase } from "@/server/db/client";

import { nextBillingPeriod, subscriptionMonthlyTotal } from "./pricing";

export type SubscriptionActionResult = { ok: true; message: string } | { ok: false; error: string };

const choosePlanSchema = z.object({
  businessId: z.uuid(),
  planId: z.uuid(),
  seats: z.coerce.number().int().min(1).max(1000),
});

const payInvoiceSchema = z.object({
  businessId: z.uuid(),
  invoiceId: z.uuid(),
});

const planSchema = z.object({
  planId: z.preprocess((value) => (value === "" ? undefined : value), z.uuid().optional()),
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase code such as studio-plus."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  priceMonthly: z.coerce.number().nonnegative({ error: "Enter a valid monthly price." }),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  includedSeats: z.coerce.number().int().min(1).max(1000),
  seatLimit: z.coerce.number().int().min(1).max(1000),
  features: z.array(z.string().trim().min(1).max(80)).max(20),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

function decimal(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function revalidateBusiness(businessId: string) {
  revalidatePath(`/business/${businessId}/subscription`);
  revalidatePath(`/business/${businessId}`);
  revalidatePath("/b2b");
  revalidatePath("/account");
}

export async function choosePlanAction(input: {
  businessId: string;
  planId: string;
  seats: number;
}): Promise<SubscriptionActionResult> {
  const access = await requireBusinessAccess(
    input.businessId,
    "subscription.manage",
    `/business/${input.businessId}/subscription`,
  );
  const parsed = choosePlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid plan and seat count." };

  const database = getDatabase();
  const plan = await database.subscriptionPlan.findFirst({
    where: { id: parsed.data.planId, status: "ACTIVE" },
    select: {
      id: true,
      priceMonthly: true,
      currency: true,
      includedSeats: true,
      seatLimit: true,
    },
  });

  if (!plan) return { ok: false, error: "That plan is not available." };
  if (parsed.data.seats > plan.seatLimit) {
    return { ok: false, error: `That plan supports up to ${plan.seatLimit} seats.` };
  }

  const now = new Date();
  const period = nextBillingPeriod(now);
  const total = subscriptionMonthlyTotal(plan.priceMonthly, parsed.data.seats, plan.includedSeats);

  try {
    await database.$transaction(async (transaction) => {
      const existing = await transaction.businessSubscription.findUnique({
        where: { businessId: access.businessId },
        select: { id: true, planId: true, seats: true, status: true },
      });

      let subscriptionId = "";
      if (existing) {
        subscriptionId = existing.id;
        await transaction.businessSubscription.update({
          where: { id: existing.id },
          data: {
            planId: plan.id,
            seats: parsed.data.seats,
            status: "ACTIVE",
            canceledAt: null,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          },
        });
      } else {
        const created = await transaction.businessSubscription.create({
          data: {
            businessId: access.businessId,
            planId: plan.id,
            seats: parsed.data.seats,
            status: "ACTIVE",
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          },
          select: { id: true },
        });
        subscriptionId = created.id;
      }

      const invoice = await transaction.subscriptionInvoice.create({
        data: {
          invoiceNumber: makeDocumentNumber("SUBINV"),
          subscriptionId,
          status: "ISSUED",
          currency: plan.currency,
          subtotal: total,
          taxTotal: "0.00",
          total,
          periodStart: period.start,
          periodEnd: period.end,
          issuedAt: now,
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      });

      await recordAuditEvent(transaction, {
        actorId: access.actorId,
        action: existing ? "BUSINESS_SUBSCRIPTION_CHANGED" : "BUSINESS_SUBSCRIPTION_CREATED",
        targetType: "business_subscription",
        targetId: subscriptionId,
        metadata: { planId: plan.id, seats: parsed.data.seats },
      });
      await recordAuditEvent(transaction, {
        actorId: access.actorId,
        action: "SUBSCRIPTION_INVOICE_ISSUED",
        targetType: "subscription_invoice",
        targetId: invoice.id,
        metadata: { total, currency: plan.currency },
      });
    });
  } catch (error) {
    logger.error("subscription.choose_failed", { businessId: access.businessId, error });
    return { ok: false, error: "The subscription could not be updated." };
  }

  revalidateBusiness(access.businessId);
  return { ok: true, message: "Subscription updated." };
}

export async function cancelSubscriptionAction(
  businessId: string,
): Promise<SubscriptionActionResult> {
  const access = await requireBusinessAccess(
    businessId,
    "subscription.manage",
    `/business/${businessId}/subscription`,
  );
  const subscription = await getDatabase().businessSubscription.findUnique({
    where: { businessId: access.businessId },
    select: { id: true, status: true },
  });

  if (!subscription || subscription.status === "CANCELLED") {
    return { ok: false, error: "There is no active subscription to cancel." };
  }

  await getDatabase().$transaction(async (transaction) => {
    await transaction.businessSubscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", canceledAt: new Date() },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actorId,
      action: "BUSINESS_SUBSCRIPTION_CHANGED",
      targetType: "business_subscription",
      targetId: subscription.id,
      metadata: { status: "CANCELLED" },
    });
  });

  revalidateBusiness(access.businessId);
  return { ok: true, message: "Subscription cancelled." };
}

export async function paySubscriptionInvoiceAction(input: {
  businessId: string;
  invoiceId: string;
}): Promise<SubscriptionActionResult> {
  const access = await requireBusinessAccess(
    input.businessId,
    "subscription.manage",
    `/business/${input.businessId}/subscription`,
  );
  const parsed = payInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That invoice could not be found." };

  const database = getDatabase();
  const invoice = await database.subscriptionInvoice.findFirst({
    where: {
      id: parsed.data.invoiceId,
      subscription: { businessId: access.businessId },
    },
    select: { id: true, total: true, status: true },
  });

  if (!invoice) return { ok: false, error: "That invoice could not be found." };
  if (invoice.status === "PAID") return { ok: true, message: "Invoice already paid." };

  const now = new Date();
  await database.$transaction(async (transaction) => {
    await transaction.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        amountPaid: invoice.total,
        paidAt: now,
      },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actorId,
      action: "SUBSCRIPTION_INVOICE_PAID",
      targetType: "subscription_invoice",
      targetId: invoice.id,
    });
  });

  revalidateBusiness(access.businessId);
  return { ok: true, message: "Invoice marked as paid." };
}

export async function saveSubscriptionPlanAction(
  input: z.infer<typeof planSchema>,
): Promise<SubscriptionActionResult> {
  const actor = await requireAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid subscription plan." };
  }

  const data = parsed.data;
  const database = getDatabase();
  let planId = data.planId ?? "";

  try {
    await database.$transaction(async (transaction) => {
      if (planId) {
        await transaction.subscriptionPlan.update({
          where: { id: planId },
          data: {
            code: data.code,
            name: data.name,
            description: data.description,
            priceMonthly: decimal(data.priceMonthly),
            currency: data.currency,
            includedSeats: data.includedSeats,
            seatLimit: data.seatLimit,
            features: data.features,
            status: data.status,
            sortOrder: data.sortOrder,
          },
        });
      } else {
        const created = await transaction.subscriptionPlan.create({
          data: {
            code: data.code,
            name: data.name,
            description: data.description,
            priceMonthly: decimal(data.priceMonthly),
            currency: data.currency,
            includedSeats: data.includedSeats,
            seatLimit: data.seatLimit,
            features: data.features,
            status: data.status,
            sortOrder: data.sortOrder,
          },
          select: { id: true },
        });
        planId = created.id;
      }

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: data.planId ? "SUBSCRIPTION_PLAN_UPDATED" : "SUBSCRIPTION_PLAN_CREATED",
        targetType: "subscription_plan",
        targetId: planId,
        metadata: { code: data.code },
      });
    });
  } catch (error) {
    logger.error("subscription.plan_save_failed", { actorId: actor.id, error });
    return { ok: false, error: "The subscription plan could not be saved." };
  }

  revalidatePath("/admin/subscriptions");
  return { ok: true, message: "Subscription plan saved." };
}
