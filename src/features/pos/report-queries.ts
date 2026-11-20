import "server-only";

import { decimalToCents } from "@/features/catalog/money";
import { getDatabase } from "@/server/db/client";

import {
  reportTotals,
  reportWindow,
  summariseReport,
  type ReportDay,
  type ReportRange,
  type ReportTotals,
} from "./report";

export interface ReportSession {
  id: string;
  registerName: string;
  openedAt: Date;
  closedAt: Date | null;
  expectedCents: number;
  countedCents: number;
  differenceCents: number;
  openedByName: string | null;
}

export interface PosReport {
  currency: string;
  days: ReportDay[];
  totals: ReportTotals;
  sessions: ReportSession[];
}

/**
 * Counter sales, cash by method, expenses, and register reconciliation for one
 * vendor. The vendor id always comes from the authorized studio context.
 */
export async function getPosReport(vendorId: string, days: ReportRange): Promise<PosReport> {
  const database = getDatabase();
  const { from } = reportWindow(days, new Date());

  const [sales, expenses, sessions, currencyRow] = await Promise.all([
    database.sale.findMany({
      where: { vendorId, soldAt: { gte: from } },
      select: {
        soldAt: true,
        total: true,
        currency: true,
        payments: { select: { method: true, amount: true } },
        items: { select: { quantity: true, unitCost: true } },
      },
      orderBy: { soldAt: "asc" },
    }),
    database.expense.findMany({
      where: { vendorId, spentAt: { gte: from } },
      select: { spentAt: true, amount: true },
    }),
    database.posSession.findMany({
      where: { vendorId, status: "CLOSED", closedAt: { gte: from } },
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        expectedCash: true,
        countedCash: true,
        register: { select: { name: true } },
        openedBy: { select: { name: true } },
      },
      orderBy: { closedAt: "desc" },
      take: 20,
    }),
    database.product.findFirst({
      where: { vendorId },
      select: { currency: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows = summariseReport(
    sales.map((sale) => ({
      soldAt: sale.soldAt,
      totalCents: decimalToCents(sale.total),
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amountCents: decimalToCents(payment.amount),
      })),
      items: sale.items.map((item) => ({
        quantity: item.quantity,
        unitCostCents: item.unitCost === null ? null : decimalToCents(item.unitCost),
      })),
    })),
    expenses.map((expense) => ({
      spentAt: expense.spentAt,
      amountCents: decimalToCents(expense.amount),
    })),
    { days, now: new Date() },
  );

  return {
    currency: currencyRow?.currency ?? sales[0]?.currency ?? "TZS",
    days: rows,
    totals: reportTotals(rows),
    sessions: sessions.map((session) => {
      const expectedCents = session.expectedCash ? decimalToCents(session.expectedCash) : 0;
      const countedCents = session.countedCash ? decimalToCents(session.countedCash) : 0;

      return {
        id: session.id,
        registerName: session.register.name,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        expectedCents,
        countedCents,
        differenceCents: countedCents - expectedCents,
        openedByName: session.openedBy?.name ?? null,
      };
    }),
  };
}
