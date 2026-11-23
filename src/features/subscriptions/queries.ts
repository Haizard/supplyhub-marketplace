import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/db/client";

import type {
  BusinessSubscriptionView,
  SubscriptionInvoiceView,
  SubscriptionPlanView,
} from "./types";

function featuresOf(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function planToView(plan: {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: { toString(): string };
  currency: string;
  includedSeats: number;
  seatLimit: number;
  features: Prisma.JsonValue;
  status: SubscriptionPlanView["status"];
  sortOrder: number;
}): SubscriptionPlanView {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly.toString(),
    currency: plan.currency,
    includedSeats: plan.includedSeats,
    seatLimit: plan.seatLimit,
    features: featuresOf(plan.features),
    status: plan.status,
    sortOrder: plan.sortOrder,
  };
}

function invoiceToView(invoice: {
  id: string;
  invoiceNumber: string;
  status: SubscriptionInvoiceView["status"];
  currency: string;
  subtotal: { toString(): string };
  taxTotal: { toString(): string };
  total: { toString(): string };
  amountPaid: { toString(): string };
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
}): SubscriptionInvoiceView {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: invoice.currency,
    subtotal: invoice.subtotal.toString(),
    taxTotal: invoice.taxTotal.toString(),
    total: invoice.total.toString(),
    amountPaid: invoice.amountPaid.toString(),
    periodStart: invoice.periodStart.toISOString(),
    periodEnd: invoice.periodEnd.toISOString(),
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
  };
}

export async function listActivePlans(): Promise<SubscriptionPlanView[]> {
  const plans = await getDatabase().subscriptionPlan.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return plans.map(planToView);
}

export async function listAllPlans(): Promise<SubscriptionPlanView[]> {
  const plans = await getDatabase().subscriptionPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return plans.map(planToView);
}

export async function getBusinessSubscription(
  businessId: string,
): Promise<BusinessSubscriptionView | null> {
  const subscription = await getDatabase().businessSubscription.findUnique({
    where: { businessId },
    include: {
      plan: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!subscription) return null;

  return {
    id: subscription.id,
    businessId: subscription.businessId,
    status: subscription.status,
    seats: subscription.seats,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    canceledAt: subscription.canceledAt?.toISOString() ?? null,
    plan: planToView(subscription.plan),
    invoices: subscription.invoices.map(invoiceToView),
  };
}
