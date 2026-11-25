import { describe, expect, it } from "vitest";

import {
  buildInstallmentReport,
  type AnalyticsAgreement,
  type AnalyticsPayment,
  type AnalyticsSchedule,
} from "@/features/installments/analytics";

const now = new Date("2026-11-25T00:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

const agreements: AnalyticsAgreement[] = [
  {
    id: "a1",
    cashPriceMinor: 1_200_000_00,
    depositAmountMinor: 300_000_00,
    outstandingMinor: 900_000_00,
    status: "ACTIVE",
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    buyerUserId: "u1",
  },
  {
    id: "a2",
    cashPriceMinor: 500_000_00,
    depositAmountMinor: 100_000_00,
    outstandingMinor: 0,
    status: "COMPLETED",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    buyerUserId: "u2",
  },
];

const payments: AnalyticsPayment[] = [
  {
    id: "p1",
    agreementId: "a1",
    amountMinor: 300_000_00,
    paidAt: new Date("2026-11-05T00:00:00.000Z"),
    status: "VERIFIED",
  },
  {
    id: "p2",
    agreementId: "a2",
    amountMinor: 500_000_00,
    paidAt: new Date("2026-10-10T00:00:00.000Z"),
    status: "VERIFIED",
  },
  {
    id: "p3",
    agreementId: "a1",
    amountMinor: 150_000_00,
    paidAt: new Date("2026-11-20T00:00:00.000Z"),
    status: "PENDING",
  },
];

const schedules: AnalyticsSchedule[] = [
  { dueDate: new Date(now.getTime() + 10 * day), status: "PENDING" },
  { dueDate: new Date(now.getTime() - 5 * day), status: "OVERDUE" },
  { dueDate: new Date(now.getTime() + 90 * day), status: "PENDING" },
];

describe("Phase 10 I5 — installment reporting", () => {
  it("derives receivables and collections from stored agreements and verified payments", () => {
    const report = buildInstallmentReport({ agreements, payments, schedules }, now);
    expect(report.agreementCount).toBe(2);
    expect(report.totalSalesMinor).toBe(1_700_000_00);
    expect(report.depositsCollectedMinor).toBe(400_000_00);
    expect(report.outstandingMinor).toBe(900_000_00);
    expect(report.collectedThisMonthMinor).toBe(300_000_00);
    expect(report.completedCount).toBe(1);
    expect(report.activeCount).toBe(1);
    expect(report.defaultedCount).toBe(0);
  });

  it("counts only upcoming windows and overdue rows", () => {
    const report = buildInstallmentReport({ agreements, payments, schedules }, now);
    expect(report.upcomingCount).toBe(1);
    expect(report.overdueCount).toBe(1);
  });

  it("groups verified monthly revenue in chronological order", () => {
    const report = buildInstallmentReport({ agreements, payments, schedules }, now);
    expect(report.monthlyRevenue).toEqual([
      { month: "2026-10", amountMinor: 500_000_00 },
      { month: "2026-11", amountMinor: 300_000_00 },
    ]);
  });
});
