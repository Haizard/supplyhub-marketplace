/**
 * Pure aggregation for the retail report. Money stays in integer cents and day
 * buckets use the server's local calendar day, the same boundary the point of sale
 * uses for "today".
 */

import { startOfDay } from "./calculation";

export type ReportPaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD" | "OTHER";

export interface ReportPayment {
  method: ReportPaymentMethod;
  amountCents: number;
}

export interface ReportSaleLine {
  quantity: number;
  /** Cost per unit captured when the sale was recorded; null means no cost was on file. */
  unitCostCents: number | null;
}

export interface ReportSale {
  soldAt: Date;
  totalCents: number;
  payments: readonly ReportPayment[];
  items?: readonly ReportSaleLine[];
}

export interface ReportExpense {
  spentAt: Date;
  amountCents: number;
}

export interface ReportDay {
  /** Local calendar day, formatted YYYY-MM-DD. */
  key: string;
  date: Date;
  salesCount: number;
  grossCents: number;
  cashCents: number;
  mobileCents: number;
  cardCents: number;
  otherCents: number;
  costCents: number;
  profitCents: number;
  /** Units sold before a unit cost was on file, so profit is understated. */
  uncostedUnits: number;
  expensesCents: number;
  netCents: number;
}

export type ReportTotals = Omit<ReportDay, "key" | "date">;

export const REPORT_RANGES = [7, 30] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

/** Only the two supported ranges are accepted; anything else falls back to a week. */
export function parseReportRange(value: string | undefined): ReportRange {
  return value === "30" ? 30 : 7;
}

export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** Oldest-first calendar buckets covering the range, ending today. */
export function reportWindow(
  days: ReportRange,
  now: Date,
): { from: Date; buckets: { key: string; date: Date }[] } {
  const from = startOfDay(now);
  from.setDate(from.getDate() - (days - 1));

  const buckets = Array.from({ length: days }, (_, offset) => {
    const date = new Date(from);
    date.setDate(from.getDate() + offset);

    return { key: dayKey(date), date };
  });

  return { from, buckets };
}

function emptyDay(key: string, date: Date): ReportDay {
  return {
    key,
    date,
    salesCount: 0,
    grossCents: 0,
    cashCents: 0,
    mobileCents: 0,
    cardCents: 0,
    otherCents: 0,
    costCents: 0,
    profitCents: 0,
    uncostedUnits: 0,
    expensesCents: 0,
    netCents: 0,
  };
}

/**
 * Buckets sales and expenses into calendar days. Sales outside the window are
 * ignored rather than clamped, and each sale's gross total is counted once even
 * when it was paid with more than one method.
 */
export function summariseReport(
  sales: readonly ReportSale[],
  expenses: readonly ReportExpense[],
  options: { days: ReportRange; now: Date },
): ReportDay[] {
  const { buckets } = reportWindow(options.days, options.now);
  const positions = new Map(buckets.map((bucket, position) => [bucket.key, position]));
  const rows = buckets.map((bucket) => emptyDay(bucket.key, bucket.date));

  for (const sale of sales) {
    const position = positions.get(dayKey(sale.soldAt));
    const row = position === undefined ? undefined : rows[position];
    if (!row) continue;

    row.salesCount += 1;
    row.grossCents += sale.totalCents;

    for (const item of sale.items ?? []) {
      if (item.unitCostCents === null) {
        row.uncostedUnits += item.quantity;
        continue;
      }

      row.costCents += item.unitCostCents * item.quantity;
    }

    for (const payment of sale.payments) {
      switch (payment.method) {
        case "CASH":
          row.cashCents += payment.amountCents;
          break;
        case "MOBILE_MONEY":
          row.mobileCents += payment.amountCents;
          break;
        case "CARD":
          row.cardCents += payment.amountCents;
          break;
        case "OTHER":
          row.otherCents += payment.amountCents;
          break;
      }
    }
  }

  for (const expense of expenses) {
    const position = positions.get(dayKey(expense.spentAt));
    const row = position === undefined ? undefined : rows[position];
    if (!row) continue;

    row.expensesCents += expense.amountCents;
  }

  for (const row of rows) {
    row.profitCents = row.grossCents - row.costCents;
    row.netCents = row.grossCents - row.expensesCents;
  }

  return rows;
}

export function reportTotals(rows: readonly ReportDay[]): ReportTotals {
  const totals: ReportTotals = {
    salesCount: 0,
    grossCents: 0,
    cashCents: 0,
    mobileCents: 0,
    cardCents: 0,
    otherCents: 0,
    costCents: 0,
    profitCents: 0,
    uncostedUnits: 0,
    expensesCents: 0,
    netCents: 0,
  };

  for (const row of rows) {
    totals.salesCount += row.salesCount;
    totals.grossCents += row.grossCents;
    totals.cashCents += row.cashCents;
    totals.mobileCents += row.mobileCents;
    totals.cardCents += row.cardCents;
    totals.otherCents += row.otherCents;
    totals.costCents += row.costCents;
    totals.profitCents += row.profitCents;
    totals.uncostedUnits += row.uncostedUnits;
    totals.expensesCents += row.expensesCents;
    totals.netCents += row.netCents;
  }

  return totals;
}
