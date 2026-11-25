import "server-only";

import { getDatabase } from "@/server/db/client";

import {
  buildInstallmentReport,
  type AnalyticsAgreement,
  type AnalyticsPayment,
  type AnalyticsSchedule,
  type InstallmentReport,
} from "./analytics";
import { toMinor } from "./payment-rules";

export interface InstallmentCustomerView {
  email: string;
  agreementCount: number;
  outstandingMinor: number;
  paidMinor: number;
}

export interface InstallmentDisputeView {
  id: string;
  disputeNumber: string;
  agreementNumber: string;
  openedByRole: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
}

export interface ReconciliationRunView {
  id: string;
  runNumber: string;
  status: string;
  checkedCount: number;
  findingCount: number;
  finishedAt: string | null;
  createdAt: string;
}

export async function getInstallmentReport(businessId: string): Promise<InstallmentReport> {
  const [agreements, payments, schedules] = await Promise.all([
    getDatabase().installmentAgreement.findMany({
      where: { businessId },
      select: {
        id: true,
        cashPrice: true,
        depositAmount: true,
        outstandingBalance: true,
        status: true,
        createdAt: true,
        buyerUserId: true,
      },
    }),
    getDatabase().installmentPayment.findMany({
      where: { agreement: { businessId } },
      select: { id: true, agreementId: true, amount: true, paidAt: true, status: true },
    }),
    getDatabase().installmentSchedule.findMany({
      where: { agreement: { businessId } },
      select: { dueDate: true, status: true },
    }),
  ]);

  const analyticsAgreements: AnalyticsAgreement[] = agreements.map((row) => ({
    id: row.id,
    cashPriceMinor: toMinor(Number(row.cashPrice.toString())),
    depositAmountMinor: toMinor(Number(row.depositAmount.toString())),
    outstandingMinor: toMinor(Number(row.outstandingBalance.toString())),
    status: row.status,
    createdAt: row.createdAt,
    buyerUserId: row.buyerUserId,
  }));
  const analyticsPayments: AnalyticsPayment[] = payments.map((row) => ({
    id: row.id,
    agreementId: row.agreementId,
    amountMinor: toMinor(Number(row.amount.toString())),
    paidAt: row.paidAt,
    status: row.status,
  }));
  const analyticsSchedules: AnalyticsSchedule[] = schedules.map((row) => ({
    dueDate: row.dueDate,
    status: row.status,
  }));

  return buildInstallmentReport({
    agreements: analyticsAgreements,
    payments: analyticsPayments,
    schedules: analyticsSchedules,
  });
}

/** Seller-side customer lookup across all of this business's agreements. */
export async function searchInstallmentCustomers(
  businessId: string,
  email: string,
): Promise<InstallmentCustomerView[]> {
  const rows = await getDatabase().installmentAgreement.findMany({
    where: {
      businessId,
      buyer: { email: { contains: email.trim().toLowerCase() } },
    },
    select: {
      outstandingBalance: true,
      buyer: { select: { email: true } },
      payments: { where: { status: "VERIFIED" }, select: { amount: true } },
    },
    take: 100,
  });

  const grouped = new Map<string, InstallmentCustomerView>();
  for (const row of rows) {
    const current = grouped.get(row.buyer.email) ?? {
      email: row.buyer.email,
      agreementCount: 0,
      outstandingMinor: 0,
      paidMinor: 0,
    };
    current.agreementCount += 1;
    current.outstandingMinor += toMinor(Number(row.outstandingBalance.toString()));
    current.paidMinor += row.payments.reduce(
      (sum, payment) => sum + toMinor(Number(payment.amount.toString())),
      0,
    );
    grouped.set(row.buyer.email, current);
  }
  return [...grouped.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export async function listInstallmentDisputes(
  businessId: string,
): Promise<InstallmentDisputeView[]> {
  const rows = await getDatabase().installmentDispute.findMany({
    where: { agreement: { businessId } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      disputeNumber: true,
      openedByRole: true,
      reason: true,
      status: true,
      resolution: true,
      createdAt: true,
      agreement: { select: { agreementNumber: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    disputeNumber: row.disputeNumber,
    agreementNumber: row.agreement.agreementNumber,
    openedByRole: row.openedByRole,
    reason: row.reason,
    status: row.status,
    resolution: row.resolution,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listInstallmentReconciliationRuns(
  businessId: string,
): Promise<ReconciliationRunView[]> {
  const rows = await getDatabase().installmentReconciliationRun.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      runNumber: true,
      status: true,
      checkedCount: true,
      findingCount: true,
      finishedAt: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    runNumber: row.runNumber,
    status: row.status,
    checkedCount: row.checkedCount,
    findingCount: row.findingCount,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listInstallmentReconciliationFindings(runId: string): Promise<string[]> {
  const rows = await getDatabase().installmentReconciliationFinding.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
    select: { code: true, severity: true, message: true, expected: true, actual: true },
  });
  return rows.map(
    (row) =>
      `${row.severity} ${row.code}: ${row.message}${
        row.expected ? ` (expected ${row.expected}, actual ${row.actual ?? "n/a"})` : ""
      }`,
  );
}
