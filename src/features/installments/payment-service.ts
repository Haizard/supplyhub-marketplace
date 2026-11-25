import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";

import { toMajor, toMinor, planPaymentAllocation, planRefund } from "./payment-rules";
import { issueInstallmentReceipt } from "./receipt-service";

export type VerificationResult = "APPLIED" | "DUPLICATE" | "MISMATCH" | "NOT_FOUND";

const decimal = (minor: number) => new Prisma.Decimal(toMajor(minor));

/** Applies a provider-verified or seller-attested payment exactly once. */
export async function applyVerifiedInstallmentPayment(input: {
  paymentId: string;
  providerPaymentId?: string | null;
  providerReference?: string | null;
  paidAt?: Date | null;
  verifiedById?: string | null;
}): Promise<VerificationResult> {
  const database = getDatabase();
  return database.$transaction(async (tx) => {
    const payment = await tx.installmentPayment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        reference: true,
        agreementId: true,
        amount: true,
        currency: true,
        status: true,
      },
    });
    if (!payment) return "NOT_FOUND";
    if (payment.status === "VERIFIED" || payment.status === "REFUNDED") return "DUPLICATE";
    if (payment.status === "FAILED") return "MISMATCH";

    const agreement = await tx.installmentAgreement.findUnique({
      where: { id: payment.agreementId },
      select: {
        id: true,
        businessId: true,
        buyerUserId: true,
        status: true,
        depositAmount: true,
        schedule: {
          select: { id: true, sequence: true, amount: true, paidAmount: true, status: true },
          orderBy: { sequence: "asc" },
        },
      },
    });
    if (!agreement) return "NOT_FOUND";

    const settings = await tx.installmentSetting.findUnique({
      where: { businessId: agreement.businessId },
      select: { allowAdvancePayments: true },
    });
    const entries = agreement.schedule.map((entry) => ({
      id: entry.id,
      sequence: entry.sequence,
      amountMinor: toMinor(Number(entry.amount.toString())),
      paidMinor: toMinor(Number(entry.paidAmount.toString())),
      status: entry.status,
    }));
    const plan = planPaymentAllocation(
      toMinor(Number(payment.amount.toString())),
      entries,
      settings?.allowAdvancePayments === true,
    );
    if (!plan.ok) {
      await tx.installmentPayment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: plan.reason.slice(0, 500),
        },
      });
      await recordAuditEvent(tx, {
        actorId: input.verifiedById ?? null,
        action: "INSTALLMENT_PAYMENT_MISMATCH",
        targetType: "InstallmentPayment",
        targetId: payment.id,
        metadata: { agreementId: agreement.id, reason: plan.reason },
      });
      return "MISMATCH";
    }

    const now = new Date();
    await tx.installmentPayment.update({
      where: { id: payment.id },
      data: {
        status: "VERIFIED",
        providerPaymentId: input.providerPaymentId ?? undefined,
        providerReference: input.providerReference ?? undefined,
        paidAt: input.paidAt ?? now,
        verifiedAt: now,
        verifiedById: input.verifiedById ?? null,
        failureReason: null,
      },
    });

    for (const allocation of plan.allocations) {
      await tx.installmentPaymentAllocation.create({
        data: {
          paymentId: payment.id,
          scheduleId: allocation.scheduleId,
          amount: decimal(allocation.amountMinor),
        },
      });
    }
    const updates = new Map(plan.updates.map((update) => [update.scheduleId, update]));
    for (const entry of entries) {
      const update = updates.get(entry.id);
      if (!update) continue;
      await tx.installmentSchedule.update({
        where: { id: entry.id },
        data: {
          paidAmount: decimal(update.paidMinor),
          status: update.status,
          paidAt: update.status === "PAID" ? now : null,
        },
      });
    }

    const newOutstandingMinor = entries.reduce((sum, entry) => {
      const paidMinor = updates.get(entry.id)?.paidMinor ?? entry.paidMinor;
      return sum + Math.max(0, entry.amountMinor - paidMinor);
    }, 0);
    const verified = await tx.installmentPayment.aggregate({
      where: { agreementId: agreement.id, status: "VERIFIED" },
      _sum: { amount: true },
    });
    const depositMinor = toMinor(Number(agreement.depositAmount.toString()));
    const paidMinor = toMinor(Number(verified._sum.amount?.toString() ?? "0"));

    const nextStatus =
      newOutstandingMinor === 0
        ? "COMPLETED"
        : agreement.status === "PENDING_DEPOSIT" && paidMinor >= depositMinor
          ? "ACTIVE"
          : agreement.status;
    await tx.installmentAgreement.update({
      where: { id: agreement.id },
      data: {
        outstandingBalance: decimal(newOutstandingMinor),
        advanceCreditAmount: decimal(plan.remainingMinor),
        status: nextStatus,
        activatedAt:
          nextStatus === "ACTIVE"
            ? agreement.status === "PENDING_DEPOSIT"
              ? now
              : undefined
            : undefined,
        completedAt: nextStatus === "COMPLETED" ? now : undefined,
      },
    });

    await tx.installmentAgreementEvent.create({
      data: {
        agreementId: agreement.id,
        type: "PAYMENT_VERIFIED",
        fromStatus: agreement.status,
        toStatus: nextStatus,
        actorId: input.verifiedById ?? null,
        metadata: {
          paymentId: payment.id,
          reference: payment.reference,
          allocatedMinor: plan.allocations.reduce((sum, item) => sum + item.amountMinor, 0),
          advanceMinor: plan.remainingMinor,
        },
      },
    });
    await issueInstallmentReceipt(tx, {
      paymentId: payment.id,
      agreementId: agreement.id,
      buyerUserId: agreement.buyerUserId,
      actorId: input.verifiedById ?? null,
    });
    await recordAuditEvent(tx, {
      actorId: input.verifiedById ?? null,
      action: "INSTALLMENT_PAYMENT_VERIFIED",
      targetType: "InstallmentPayment",
      targetId: payment.id,
      metadata: {
        agreementId: agreement.id,
        reference: payment.reference,
        status: nextStatus,
      },
    });
    return "APPLIED";
  });
}

/** Refunds reverse the payment's allocations and restore the outstanding balance. */
export async function refundInstallmentPayment(input: {
  paymentId: string;
  actorId: string;
  reason: string;
  providerRefund?: (
    providerPaymentId: string,
    amountMinor: number,
    reason: string,
  ) => Promise<void>;
}): Promise<"REFUNDED" | "NOT_FOUND" | "INVALID"> {
  const database: PrismaClient = getDatabase();
  const payment = await database.installmentPayment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      reference: true,
      agreementId: true,
      amount: true,
      status: true,
      provider: true,
      providerPaymentId: true,
      allocations: { select: { scheduleId: true, amount: true } },
    },
  });
  if (!payment || payment.status !== "VERIFIED") return "INVALID";

  if (payment.providerPaymentId && payment.provider) {
    if (!input.providerRefund) return "INVALID";
    try {
      await input.providerRefund(
        payment.providerPaymentId,
        toMinor(Number(payment.amount.toString())),
        input.reason,
      );
    } catch (error) {
      logger.error("installment.refund_provider_failed", {
        paymentId: payment.id,
        message: error instanceof Error ? error.message : "unknown error",
      });
      return "INVALID";
    }
  }

  await database.$transaction(async (tx) => {
    const agreement = await tx.installmentAgreement.findUnique({
      where: { id: payment.agreementId },
      select: { id: true, status: true, advanceCreditAmount: true },
    });
    if (!agreement) throw new Error("Agreement missing for payment refund.");

    const reductions = planRefund(
      toMinor(Number(payment.amount.toString())),
      payment.allocations.map((row) => ({
        scheduleId: row.scheduleId,
        paidMinor: toMinor(Number(row.amount.toString())),
      })),
    );
    for (const reduction of reductions.reductions) {
      const allocation = await tx.installmentSchedule.findUnique({
        where: { id: reduction.scheduleId },
        select: { id: true, paidAmount: true, status: true },
      });
      if (!allocation) continue;
      const paidMinor = Math.max(
        0,
        toMinor(Number(allocation.paidAmount.toString())) - reduction.amountMinor,
      );
      await tx.installmentSchedule.update({
        where: { id: allocation.id },
        data: { paidAmount: decimal(paidMinor), status: "PENDING", paidAt: null },
      });
    }

    await tx.installmentPayment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED", failureReason: input.reason.slice(0, 500) },
    });

    const outstanding = await tx.installmentSchedule.aggregate({
      where: { agreementId: payment.agreementId, status: { not: "WAIVED" } },
      _sum: { amount: true, paidAmount: true },
    });
    const outstandingMinor = Math.max(
      0,
      toMinor(Number(outstanding._sum.amount?.toString() ?? "0")) -
        toMinor(Number(outstanding._sum.paidAmount?.toString() ?? "0")),
    );
    await tx.installmentAgreement.update({
      where: { id: agreement.id },
      data: {
        outstandingBalance: decimal(outstandingMinor),
        status: agreement.status === "COMPLETED" ? "ACTIVE" : agreement.status,
        completedAt: agreement.status === "COMPLETED" ? null : undefined,
        advanceCreditAmount: new Prisma.Decimal(0),
      },
    });
    await tx.installmentAgreementEvent.create({
      data: {
        agreementId: agreement.id,
        type: "PAYMENT_REFUNDED",
        fromStatus: agreement.status,
        toStatus: agreement.status === "COMPLETED" ? "ACTIVE" : agreement.status,
        actorId: input.actorId,
        metadata: { paymentId: payment.id, reason: input.reason },
      },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "INSTALLMENT_PAYMENT_REFUNDED",
      targetType: "InstallmentPayment",
      targetId: payment.id,
      metadata: { agreementId: agreement.id, reason: input.reason },
    });
  });
  return "REFUNDED";
}
