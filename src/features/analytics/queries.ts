import "server-only";

import { getDatabase } from "@/server/db/client";

export interface PlatformMetric {
  label: string;
  value: string;
  source: string;
}

export interface PlatformAnalytics {
  gmv: PlatformMetric;
  paidOrders: PlatformMetric;
  activeStudios: PlatformMetric;
  commission: PlatformMetric;
  refunds: PlatformMetric;
  payouts: PlatformMetric;
  newCustomers: PlatformMetric;
  openDisputes: PlatformMetric;
  pendingVerification: PlatformMetric;
}

const PAID_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

function money(value: { _sum: { amount: { toString(): string } | null } }): string {
  return value._sum.amount?.toString() ?? "0.00";
}

/** Every metric is read from the table named in its `source` field. */
export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  const database = getDatabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    orderStats,
    paidOrders,
    activeStudios,
    commission,
    refunds,
    payouts,
    newCustomers,
    openDisputes,
    pendingVerification,
  ] = await Promise.all([
    database.order.aggregate({
      where: { status: { in: [...PAID_ORDER_STATUSES] } },
      _sum: { total: true },
    }),
    database.order.count({ where: { status: { in: [...PAID_ORDER_STATUSES] } } }),
    database.vendor.count({ where: { status: "APPROVED" } }),
    database.commissionLedger.aggregate({
      where: { type: "PLATFORM_COMMISSION" },
      _sum: { amount: true },
    }),
    database.refund.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amount: true },
    }),
    database.payout.aggregate({
      where: { status: { in: ["PAID", "RECONCILED"] } },
      _sum: { amount: true },
    }),
    database.user.count({ where: { createdAt: { gte: since } } }),
    database.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    database.businessVerificationDocument.count({ where: { status: "PENDING" } }),
  ]);

  return {
    gmv: {
      label: "Gross merchandise value",
      value: orderStats._sum.total?.toString() ?? "0.00",
      source: "orders.total (paid statuses)",
    },
    paidOrders: {
      label: "Paid orders",
      value: String(paidOrders),
      source: "orders.status",
    },
    activeStudios: {
      label: "Active studios",
      value: String(activeStudios),
      source: "vendors.status = APPROVED",
    },
    commission: {
      label: "Platform commission",
      value: money(commission),
      source: "commission_ledger.type = PLATFORM_COMMISSION",
    },
    refunds: {
      label: "Refunds paid",
      value: money(refunds),
      source: "refunds.status = SUCCEEDED",
    },
    payouts: {
      label: "Payouts settled",
      value: money(payouts),
      source: "payouts.status in PAID, RECONCILED",
    },
    newCustomers: {
      label: "New customers (30d)",
      value: String(newCustomers),
      source: "users.createdAt",
    },
    openDisputes: {
      label: "Open disputes",
      value: String(openDisputes),
      source: "disputes.status in OPEN, UNDER_REVIEW",
    },
    pendingVerification: {
      label: "Pending verification",
      value: String(pendingVerification),
      source: "business_verification_documents.status = PENDING",
    },
  };
}
