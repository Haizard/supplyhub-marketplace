"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import { calculateSettlementNet, payoutEligibility } from "./calculation";
import {
  compensationSchema,
  earningSchema,
  earningStatusSchema,
  expenseSchema,
  payoutSchema,
  payoutStatusSchema,
  settlementSchema,
} from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}
const decimal = (value: number) => new Prisma.Decimal(value);

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

async function membershipFor(companyId: string, membershipId: string) {
  const membership = await getDatabase().driverCompanyMembership.findFirst({
    where: { id: membershipId, companyId },
    select: { id: true, companyId: true },
  });
  return membership;
}

export async function saveCompensationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = compensationSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    membershipId: formValue(formData, "membershipId"),
    mode: formValue(formData, "mode"),
    currency: formValue(formData, "currency") || "TZS",
    fixedAmount: formValue(formData, "fixedAmount"),
    perDelivery: formValue(formData, "perDelivery"),
    rateBps: formValue(formData, "rateBps"),
    dailyAmount: formValue(formData, "dailyAmount"),
    effectiveFrom: formValue(formData, "effectiveFrom"),
    notes: formValue(formData, "notes"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/finance`,
  );
  if (!(await membershipFor(access.companyId, parsed.data.membershipId))) {
    return fail("That driver is not active in this company.");
  }

  await getDatabase().$transaction(async (tx) => {
    await tx.driverCompensationRule.upsert({
      where: { membershipId: parsed.data.membershipId },
      create: {
        membershipId: parsed.data.membershipId,
        mode: parsed.data.mode,
        currency: parsed.data.currency,
        fixedAmount:
          parsed.data.fixedAmount !== undefined ? decimal(parsed.data.fixedAmount) : null,
        perDelivery:
          parsed.data.perDelivery !== undefined ? decimal(parsed.data.perDelivery) : null,
        rateBps: parsed.data.rateBps ?? null,
        dailyAmount:
          parsed.data.dailyAmount !== undefined ? decimal(parsed.data.dailyAmount) : null,
        effectiveFrom: parsed.data.effectiveFrom,
        notes: parsed.data.notes ?? null,
      },
      update: {
        mode: parsed.data.mode,
        currency: parsed.data.currency,
        fixedAmount:
          parsed.data.fixedAmount !== undefined ? decimal(parsed.data.fixedAmount) : null,
        perDelivery:
          parsed.data.perDelivery !== undefined ? decimal(parsed.data.perDelivery) : null,
        rateBps: parsed.data.rateBps ?? null,
        dailyAmount:
          parsed.data.dailyAmount !== undefined ? decimal(parsed.data.dailyAmount) : null,
        effectiveFrom: parsed.data.effectiveFrom,
        notes: parsed.data.notes ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_COMPENSATION_SAVED",
      targetType: "DriverCompanyMembership",
      targetId: parsed.data.membershipId,
      metadata: { companyId: access.companyId, mode: parsed.data.mode },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  return ok("Compensation rule saved.");
}

export async function createEarningAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = earningSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    membershipId: formValue(formData, "membershipId"),
    jobId: formValue(formData, "jobId"),
    basis: formValue(formData, "basis"),
    amount: formValue(formData, "amount"),
    currency: formValue(formData, "currency") || "TZS",
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/finance`,
  );
  if (!(await membershipFor(access.companyId, parsed.data.membershipId))) {
    return fail("That driver is not active in this company.");
  }

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    if (parsed.data.jobId) {
      const job = await tx.deliveryJob.findFirst({
        where: { id: parsed.data.jobId, companyId: access.companyId },
        select: { id: true },
      });
      if (!job) return "no-job" as const;
      const existing = await tx.driverEarning.findUnique({
        where: { jobId: job.id },
        select: { id: true },
      });
      if (existing) return "duplicate" as const;
    }

    const created = await tx.driverEarning.create({
      data: {
        companyId: access.companyId,
        membershipId: parsed.data.membershipId,
        jobId: parsed.data.jobId ?? null,
        basis: parsed.data.basis,
        amount: decimal(parsed.data.amount),
        currency: parsed.data.currency,
        status: "PENDING",
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_EARNING_CREATED",
      targetType: "DriverEarning",
      targetId: created.id,
      metadata: { companyId: access.companyId, amount: parsed.data.amount },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  if (result === "no-job") return fail("That job is not part of this company.");
  if (result === "duplicate") return fail("An earning already exists for that job.");
  return ok("Earning recorded.");
}

export async function updateEarningStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = earningStatusSchema.safeParse({
    earningId: formValue(formData, "earningId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    companyId,
    `/logistics/${companyId}/finance`,
  );
  const result = await getDatabase().$transaction(async (tx) => {
    const earning = await tx.driverEarning.findFirst({
      where: { id: parsed.data.earningId, companyId: access.companyId, status: "PENDING" },
      select: { id: true },
    });
    if (!earning) return "not-found" as const;
    await tx.driverEarning.update({
      where: { id: earning.id },
      data: {
        status: parsed.data.toStatus,
        approvedById: access.actorId,
        approvedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_EARNING_STATUS_CHANGED",
      targetType: "DriverEarning",
      targetId: earning.id,
      metadata: { companyId: access.companyId, status: parsed.data.toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  if (result === "not-found") return fail("That pending earning could not be found.");
  return ok("Earning updated.");
}

export async function createPayoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = payoutSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    membershipId: formValue(formData, "membershipId"),
    amount: formValue(formData, "amount"),
    currency: formValue(formData, "currency") || "TZS",
    periodStart: formValue(formData, "periodStart"),
    periodEnd: formValue(formData, "periodEnd"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if (parsed.data.periodEnd <= parsed.data.periodStart)
    return fail("Period end must follow the start.");

  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/finance`,
  );
  if (!(await membershipFor(access.companyId, parsed.data.membershipId))) {
    return fail("That driver is not active in this company.");
  }

  const database = getDatabase();
  const earnings = await database.driverEarning.findMany({
    where: {
      companyId: access.companyId,
      membershipId: parsed.data.membershipId,
      createdAt: { gte: parsed.data.periodStart, lte: parsed.data.periodEnd },
    },
    select: { amount: true, status: true },
  });
  const paid = await database.driverPayout.aggregate({
    where: {
      companyId: access.companyId,
      membershipId: parsed.data.membershipId,
      status: "PAID",
    },
    _sum: { amount: true },
  });
  const eligibility = payoutEligibility(
    earnings.map((earning) => ({ amount: earning.amount.toString(), status: earning.status })),
    paid._sum.amount?.toString() ?? "0",
    parsed.data.amount,
  );
  if (!eligibility.eligible) return fail(`Only ${eligibility.available} is available for payout.`);

  const created = await database.$transaction(async (tx) => {
    const payout = await tx.driverPayout.create({
      data: {
        payoutNumber: makeDocumentNumber("DP"),
        companyId: access.companyId,
        membershipId: parsed.data.membershipId,
        status: "DRAFT",
        amount: decimal(parsed.data.amount),
        currency: parsed.data.currency,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        note: parsed.data.note ?? null,
        createdById: access.actorId,
      },
      select: { id: true, payoutNumber: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_PAYOUT_CREATED",
      targetType: "DriverPayout",
      targetId: payout.id,
      metadata: { companyId: access.companyId, payoutNumber: payout.payoutNumber },
    });
    return payout;
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  return ok(`Payout ${created.payoutNumber} created as a draft.`);
}

export async function updatePayoutStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = payoutStatusSchema.safeParse({
    payoutId: formValue(formData, "payoutId"),
    toStatus: formValue(formData, "toStatus"),
    reference: formValue(formData, "reference"),
    paymentProof: formValue(formData, "paymentProof"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    companyId,
    `/logistics/${companyId}/finance`,
  );
  const { payoutId, toStatus, reference, paymentProof, reason } = parsed.data;

  // Never mark a payout paid without payment confirmation evidence.
  if (toStatus === "PAID" && !reference && !paymentProof) {
    return fail("A payment reference or proof is required before marking a payout paid.");
  }
  if (toStatus === "FAILED" && !reason) return fail("Explain why the payout failed.");

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const payout = await tx.driverPayout.findFirst({
      where: { id: payoutId, companyId: access.companyId },
      select: { id: true, status: true, payoutNumber: true },
    });
    if (!payout) return "not-found" as const;
    const allowed: Record<string, string[]> = {
      DRAFT: ["APPROVED", "FAILED"],
      APPROVED: ["PAID", "FAILED"],
      FAILED: [],
      PAID: [],
    };
    if (!allowed[payout.status]?.includes(toStatus)) return "invalid" as const;

    await tx.driverPayout.update({
      where: { id: payout.id },
      data: {
        status: toStatus,
        reference: reference ?? undefined,
        paymentProof: paymentProof ?? undefined,
        failedReason: toStatus === "FAILED" ? reason : null,
        approvedById: toStatus === "APPROVED" || toStatus === "PAID" ? access.actorId : undefined,
        approvedAt: toStatus === "APPROVED" || toStatus === "PAID" ? new Date() : undefined,
        paidAt: toStatus === "PAID" ? new Date() : undefined,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_PAYOUT_STATUS_CHANGED",
      targetType: "DriverPayout",
      targetId: payout.id,
      metadata: {
        companyId: access.companyId,
        payoutNumber: payout.payoutNumber,
        status: toStatus,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: `logistics.driver_payout.${toStatus.toLowerCase()}`,
      aggregateType: "DriverPayout",
      aggregateId: payout.id,
      payload: { companyId: access.companyId, status: toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  if (result === "not-found") return fail("That payout could not be found.");
  if (result === "invalid") return fail("That payout change is not allowed.");
  return ok("Payout updated.");
}

export async function recordExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = expenseSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    vehicleId: formValue(formData, "vehicleId"),
    category: formValue(formData, "category"),
    amount: formValue(formData, "amount"),
    currency: formValue(formData, "currency") || "TZS",
    occurredAt: formValue(formData, "occurredAt"),
    reference: formValue(formData, "reference"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.finance.read",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/finance`,
  );
  const database = getDatabase();
  if (parsed.data.vehicleId) {
    const vehicle = await database.logisticsVehicle.findFirst({
      where: { id: parsed.data.vehicleId, companyId: access.companyId },
      select: { id: true },
    });
    if (!vehicle) return fail("That vehicle is not part of this company.");
  }

  await database.$transaction(async (tx) => {
    await tx.logisticsExpense.create({
      data: {
        companyId: access.companyId,
        vehicleId: parsed.data.vehicleId ?? null,
        category: parsed.data.category,
        amount: decimal(parsed.data.amount),
        currency: parsed.data.currency,
        occurredAt: parsed.data.occurredAt,
        reference: parsed.data.reference ?? null,
        note: parsed.data.note ?? null,
        createdById: access.actorId,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_EXPENSE_RECORDED",
      targetType: "LogisticsCompany",
      targetId: access.companyId,
      metadata: { category: parsed.data.category, amount: parsed.data.amount },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  return ok("Expense recorded.");
}

export async function createSettlementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = settlementSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    periodStart: formValue(formData, "periodStart"),
    periodEnd: formValue(formData, "periodEnd"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if (parsed.data.periodEnd <= parsed.data.periodStart)
    return fail("Period end must follow the start.");

  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/finance`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const existing = await tx.logisticsSettlement.findFirst({
      where: {
        companyId: access.companyId,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        status: { not: "DISPUTED" },
      },
      select: { id: true },
    });
    if (existing) return "duplicate" as const;

    const invoices = await tx.logisticsInvoice.findMany({
      where: {
        companyId: access.companyId,
        status: "PAID",
        createdAt: { gte: parsed.data.periodStart, lte: parsed.data.periodEnd },
      },
      select: { total: true },
    });
    const platformFees = await tx.logisticsExpense.aggregate({
      where: {
        companyId: access.companyId,
        category: "PLATFORM_FEE",
        occurredAt: { gte: parsed.data.periodStart, lte: parsed.data.periodEnd },
      },
      _sum: { amount: true },
    });
    const driverCosts = await tx.driverPayout.aggregate({
      where: {
        companyId: access.companyId,
        status: "PAID",
        periodStart: { gte: parsed.data.periodStart },
        periodEnd: { lte: parsed.data.periodEnd },
      },
      _sum: { amount: true },
    });
    const expenses = await tx.logisticsExpense.aggregate({
      where: {
        companyId: access.companyId,
        category: { not: "PLATFORM_FEE" },
        occurredAt: { gte: parsed.data.periodStart, lte: parsed.data.periodEnd },
      },
      _sum: { amount: true },
    });
    const revenue = invoices.reduce(
      (sum, invoice) => sum.plus(invoice.total),
      new Prisma.Decimal(0),
    );
    const totals = {
      revenue,
      platformFees: platformFees._sum.amount ?? new Prisma.Decimal(0),
      driverCosts: driverCosts._sum.amount ?? new Prisma.Decimal(0),
      expenses: expenses._sum.amount ?? new Prisma.Decimal(0),
    };
    const net = calculateSettlementNet({
      revenue: totals.revenue.toString(),
      platformFees: totals.platformFees.toString(),
      driverCosts: totals.driverCosts.toString(),
      expenses: totals.expenses.toString(),
    });

    const settlement = await tx.logisticsSettlement.create({
      data: {
        settlementNumber: makeDocumentNumber("LST"),
        companyId: access.companyId,
        status: "DRAFT",
        revenue: totals.revenue,
        platformFees: totals.platformFees,
        driverCosts: totals.driverCosts,
        expenses: totals.expenses,
        net: decimal(Number(net)),
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        note: parsed.data.note ?? null,
      },
      select: { id: true, settlementNumber: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_SETTLEMENT_CREATED",
      targetType: "LogisticsSettlement",
      targetId: settlement.id,
      metadata: { companyId: access.companyId, settlementNumber: settlement.settlementNumber },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  if (result === "duplicate") return fail("A settlement already exists for that period.");
  return ok("Settlement generated.");
}

export async function reconcileSettlementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = z.uuid().safeParse(formValue(formData, "settlementId"));
  if (!parsed.success) return fail("Invalid settlement.");

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    companyId,
    `/logistics/${companyId}/finance`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const settlement = await tx.logisticsSettlement.findFirst({
      where: { id: parsed.data, companyId: access.companyId, status: "DRAFT" },
      select: { id: true, settlementNumber: true },
    });
    if (!settlement) return "not-found" as const;
    await tx.logisticsSettlement.update({
      where: { id: settlement.id },
      data: { status: "RECONCILED", reconciledById: access.actorId, reconciledAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_SETTLEMENT_RECONCILED",
      targetType: "LogisticsSettlement",
      targetId: settlement.id,
      metadata: { companyId: access.companyId, settlementNumber: settlement.settlementNumber },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/finance`);
  if (result === "not-found") return fail("That draft settlement could not be found.");
  return ok("Settlement reconciled.");
}
