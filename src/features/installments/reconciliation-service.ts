import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";

export interface InstallmentReconciliationOutcome {
  runId: string;
  runNumber: string;
  checkedCount: number;
  findingCount: number;
}

interface Finding {
  paymentId: string | null;
  severity: "INFO" | "WARNING" | "ERROR";
  code: string;
  message: string;
  expected?: string;
  actual?: string;
}

const toMinor = (value: Prisma.Decimal): number => Math.round(Number(value.toString()) * 100);

/** Compares verified installment payments with receipts and allocation totals. */
export async function reconcileInstallmentBusiness(
  businessId: string,
  actorId: string,
): Promise<InstallmentReconciliationOutcome> {
  const database = getDatabase();
  return database.$transaction(async (tx) => {
    const run = await tx.installmentReconciliationRun.create({
      data: {
        runNumber: makeDocumentNumber("IR"),
        businessId,
        initiatedById: actorId,
        status: "RUNNING",
      },
      select: { id: true, runNumber: true },
    });

    const payments = await tx.installmentPayment.findMany({
      where: { agreement: { businessId }, status: "VERIFIED" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        amount: true,
        currency: true,
        provider: true,
        providerPaymentId: true,
        receipt: { select: { id: true } },
        agreement: { select: { currency: true } },
        allocations: { select: { amount: true } },
      },
    });

    const findings: Finding[] = [];
    for (const payment of payments) {
      const amountMinor = toMinor(payment.amount);
      if (!payment.receipt) {
        findings.push({
          paymentId: payment.id,
          severity: "ERROR",
          code: "MISSING_RECEIPT",
          message: "A verified payment has no receipt.",
        });
      }
      const allocatedMinor = payment.allocations.reduce((sum, row) => sum + toMinor(row.amount), 0);
      if (allocatedMinor !== amountMinor) {
        findings.push({
          paymentId: payment.id,
          severity: "ERROR",
          code: "ALLOCATION_MISMATCH",
          message: "Allocated amount does not equal the verified payment amount.",
          expected: String(amountMinor),
          actual: String(allocatedMinor),
        });
      }
      if (payment.currency.toUpperCase() !== payment.agreement.currency.toUpperCase()) {
        findings.push({
          paymentId: payment.id,
          severity: "ERROR",
          code: "CURRENCY_MISMATCH",
          message: "Payment currency differs from the agreement currency.",
          expected: payment.agreement.currency,
          actual: payment.currency,
        });
      }
      if (payment.provider && !payment.providerPaymentId) {
        findings.push({
          paymentId: payment.id,
          severity: "WARNING",
          code: "MISSING_PROVIDER_ID",
          message: "Provider payment has no provider reference for follow-up.",
        });
      }
    }

    if (findings.length > 0) {
      await tx.installmentReconciliationFinding.createMany({
        data: findings.map((finding) => ({
          runId: run.id,
          installmentPaymentId: finding.paymentId,
          severity: finding.severity,
          code: finding.code,
          message: finding.message,
          expected: finding.expected ?? null,
          actual: finding.actual ?? null,
        })),
      });
    }

    await tx.installmentReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        checkedCount: payments.length,
        findingCount: findings.length,
        finishedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId,
      action: "INSTALLMENT_RECONCILIATION_COMPLETED",
      targetType: "InstallmentReconciliationRun",
      targetId: run.id,
      metadata: {
        businessId,
        checkedCount: payments.length,
        findingCount: findings.length,
      } satisfies Prisma.InputJsonObject,
    });

    return {
      runId: run.id,
      runNumber: run.runNumber,
      checkedCount: payments.length,
      findingCount: findings.length,
    };
  });
}
