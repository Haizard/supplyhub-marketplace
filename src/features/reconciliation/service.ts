import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";

import { makeDocumentNumber } from "@/features/b2b/pricing";

export interface ReconciliationOutcome {
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

const PAID_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/**
 * Compares completed payments with their append-only ledger entries and with
 * the parent order status. Findings and the run row are written atomically.
 */
export async function reconcilePayments(
  initiatedById: string | null,
): Promise<ReconciliationOutcome> {
  const database = getDatabase();

  return database.$transaction(async (tx) => {
    const runNumber = makeDocumentNumber("RC");
    const run = await tx.reconciliationRun.create({
      data: { runNumber, status: "RUNNING", initiatedById },
      select: { id: true, runNumber: true },
    });

    const payments = await tx.payment.findMany({
      where: { status: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        netAmount: true,
        orderId: true,
        order: { select: { status: true } },
      },
    });

    const paymentIds = payments.map((payment) => payment.id);
    const ledgerRows = await tx.commissionLedger.findMany({
      where: { paymentId: { in: paymentIds } },
      select: { paymentId: true, type: true, amount: true },
    });

    const earnings = new Map<string, Prisma.Decimal>();
    for (const row of ledgerRows) {
      if (row.paymentId && row.type === "VENDOR_EARNING") {
        const current = earnings.get(row.paymentId) ?? new Prisma.Decimal(0);
        earnings.set(row.paymentId, current.plus(row.amount));
      }
    }

    const findings: Finding[] = [];
    for (const payment of payments) {
      const total = earnings.get(payment.id);
      if (!total) {
        findings.push({
          paymentId: payment.id,
          severity: "ERROR",
          code: "MISSING_COMMISSION_LEDGER",
          message: "Completed payment has no vendor earning ledger entry.",
          expected: payment.netAmount.toString(),
          actual: "0",
        });
      } else if (!total.equals(payment.netAmount)) {
        findings.push({
          paymentId: payment.id,
          severity: "ERROR",
          code: "LEDGER_NET_MISMATCH",
          message: "Vendor earning entries do not sum to the payment net amount.",
          expected: payment.netAmount.toString(),
          actual: total.toString(),
        });
      }

      if (!(PAID_ORDER_STATUSES as readonly string[]).includes(payment.order.status)) {
        findings.push({
          paymentId: payment.id,
          severity: "WARNING",
          code: "ORDER_STATUS_MISMATCH",
          message: "A completed payment belongs to an order that is not in a paid state.",
          expected: "PAID or later",
          actual: payment.order.status,
        });
      }
    }

    const succeededRefunds = await tx.refund.findMany({
      where: { status: "SUCCEEDED" },
      take: 200,
      select: { id: true, paymentId: true, amount: true },
    });
    if (succeededRefunds.length > 0) {
      const reversals = await tx.commissionLedger.findMany({
        where: { refundId: { in: succeededRefunds.map((r) => r.id) } },
        select: { refundId: true },
      });
      const reversed = new Set(reversals.map((row) => row.refundId));
      for (const refund of succeededRefunds) {
        if (!reversed.has(refund.id)) {
          findings.push({
            paymentId: refund.paymentId,
            severity: "ERROR",
            code: "REFUND_WITHOUT_REVERSAL",
            message: "Succeeded refund has no ledger reversal.",
            expected: refund.amount.toString(),
            actual: "0",
          });
        }
      }
    }

    if (findings.length > 0) {
      await tx.reconciliationFinding.createMany({
        data: findings.map((finding) => ({
          runId: run.id,
          paymentId: finding.paymentId,
          severity: finding.severity,
          code: finding.code,
          message: finding.message,
          expected: finding.expected ?? null,
          actual: finding.actual ?? null,
        })),
      });
    }

    await tx.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        checkedCount: payments.length + succeededRefunds.length,
        findingCount: findings.length,
        finishedAt: new Date(),
      },
    });

    await recordAuditEvent(tx, {
      actorId: initiatedById,
      action: "RECONCILIATION_RUN_COMPLETED",
      targetType: "ReconciliationRun",
      targetId: run.id,
      metadata: { runNumber, checked: payments.length, findings: findings.length },
    });

    return {
      runId: run.id,
      runNumber: run.runNumber,
      checkedCount: payments.length + succeededRefunds.length,
      findingCount: findings.length,
    };
  });
}
