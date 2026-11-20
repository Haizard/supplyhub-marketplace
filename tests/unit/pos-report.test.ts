import { describe, expect, it } from "vitest";

import {
  dayKey,
  parseReportRange,
  reportTotals,
  reportWindow,
  summariseReport,
} from "@/features/pos/report";

const now = new Date(2026, 10, 18, 16, 30);

function sale(
  day: number,
  totalCents: number,
  payments: [string, number][] = [],
  items: { quantity: number; unitCostCents: number | null }[] = [],
) {
  return {
    soldAt: new Date(2026, 10, day, 10, 0),
    totalCents,
    payments: payments.map(([method, amountCents]) => ({
      method: method as "CASH" | "MOBILE_MONEY" | "CARD" | "OTHER",
      amountCents,
    })),
    items,
  };
}

describe("reportWindow", () => {
  it("returns seven oldest-first days ending today", () => {
    const { buckets, from } = reportWindow(7, now);

    expect(buckets).toHaveLength(7);
    expect(buckets[0]?.key).toBe("2026-11-12");
    expect(buckets[6]?.key).toBe("2026-11-18");
    expect(from.getHours()).toBe(0);
  });

  it("spans a month boundary without drifting", () => {
    const { buckets } = reportWindow(7, new Date(2026, 11, 2, 9, 0));

    expect(buckets.map((bucket) => bucket.key)).toEqual([
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });
});

describe("summariseReport", () => {
  it("fills every day in the range, including days with no activity", () => {
    const rows = summariseReport([], [], { days: 7, now });

    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.grossCents === 0 && row.netCents === 0)).toBe(true);
  });

  it("counts a sale once and splits its payments by method", () => {
    const rows = summariseReport(
      [
        sale(18, 50_000, [
          ["CASH", 30_000],
          ["MOBILE_MONEY", 20_000],
        ]),
      ],
      [],
      { days: 7, now },
    );
    const today = rows[6];

    expect(today?.salesCount).toBe(1);
    expect(today?.grossCents).toBe(50_000);
    expect(today?.cashCents).toBe(30_000);
    expect(today?.mobileCents).toBe(20_000);
    expect(today?.cardCents).toBe(0);
  });

  it("subtracts expenses from the same day to give net sales", () => {
    const rows = summariseReport(
      [sale(17, 120_000, [["CARD", 120_000]])],
      [{ spentAt: new Date(2026, 10, 17, 15, 0), amountCents: 45_000 }],
      { days: 7, now },
    );

    expect(rows[5]?.netCents).toBe(75_000);
    expect(rows[5]?.expensesCents).toBe(45_000);
  });

  it("ignores sales and expenses outside the window", () => {
    const rows = summariseReport(
      [sale(1, 9_900), sale(18, 1_000)],
      [{ spentAt: new Date(2026, 9, 30, 9, 0), amountCents: 5_000 }],
      { days: 7, now },
    );

    expect(reportTotals(rows).grossCents).toBe(1_000);
    expect(reportTotals(rows).expensesCents).toBe(0);
  });

  it("keeps the day boundaries local so a late sale stays on its own day", () => {
    const late = { soldAt: new Date(2026, 10, 18, 23, 59), totalCents: 2_500, payments: [] };
    const rows = summariseReport([late], [], { days: 7, now });

    expect(dayKey(late.soldAt)).toBe("2026-11-18");
    expect(rows[6]?.grossCents).toBe(2_500);
  });

  it("totals every column across the range", () => {
    const rows = summariseReport(
      [sale(16, 10_000, [["CASH", 10_000]]), sale(18, 5_000, [["OTHER", 5_000]])],
      [{ spentAt: new Date(2026, 10, 18, 8, 0), amountCents: 1_500 }],
      { days: 7, now },
    );
    const totals = reportTotals(rows);

    expect(totals).toMatchObject({
      salesCount: 2,
      grossCents: 15_000,
      cashCents: 10_000,
      otherCents: 5_000,
      expensesCents: 1_500,
      netCents: 13_500,
    });
  });

  it("derives cost of goods and gross profit from the cost snapshot on each line", () => {
    const rows = summariseReport(
      [
        sale(
          18,
          60_000,
          [["CASH", 60_000]],
          [
            { quantity: 2, unitCostCents: 20_000 },
            { quantity: 1, unitCostCents: 5_000 },
          ],
        ),
      ],
      [],
      { days: 7, now },
    );

    expect(rows[6]?.costCents).toBe(45_000);
    expect(rows[6]?.profitCents).toBe(15_000);
    expect(rows[6]?.uncostedUnits).toBe(0);
  });

  it("flags sold units with no cost instead of assuming a cost", () => {
    const rows = summariseReport(
      [
        sale(
          18,
          40_000,
          [["CARD", 40_000]],
          [
            { quantity: 3, unitCostCents: null },
            { quantity: 1, unitCostCents: 10_000 },
          ],
        ),
      ],
      [],
      { days: 7, now },
    );

    expect(rows[6]?.costCents).toBe(10_000);
    expect(rows[6]?.profitCents).toBe(30_000);
    expect(rows[6]?.uncostedUnits).toBe(3);
  });

  it("keeps gross profit separate from net after expenses", () => {
    const rows = summariseReport(
      [sale(18, 50_000, [["CASH", 50_000]], [{ quantity: 2, unitCostCents: 15_000 }])],
      [{ spentAt: new Date(2026, 10, 18, 12, 0), amountCents: 8_000 }],
      { days: 7, now },
    );
    const totals = reportTotals(rows);

    expect(totals.costCents).toBe(30_000);
    expect(totals.profitCents).toBe(20_000);
    expect(totals.netCents).toBe(42_000);
  });

  it("allows a net loss day", () => {
    const rows = summariseReport(
      [],
      [{ spentAt: new Date(2026, 10, 18, 9, 0), amountCents: 40_000 }],
      { days: 7, now },
    );

    expect(rows[6]?.netCents).toBe(-40_000);
  });
});

describe("parseReportRange", () => {
  it("accepts only the supported ranges", () => {
    expect(parseReportRange("30")).toBe(30);
    expect(parseReportRange("7")).toBe(7);
    expect(parseReportRange(undefined)).toBe(7);
    expect(parseReportRange("365")).toBe(7);
  });
});
