import { describe, expect, it } from "vitest";

import {
  buildAgingReport,
  buildCollectionForecast,
  buildRepaymentKpis,
} from "@/features/installments/advanced-analytics";
import { buildContractBody, hashContractBody } from "@/features/installments/contract-service";
import {
  createInstallmentDocumentSchema,
  signInstallmentDocumentSchema,
  submitInstallmentFinancingSchema,
} from "@/features/installments/validation";

const now = new Date("2026-11-25T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const snapshot = {
  seller: { name: "Example Shop", code: "B-1" },
  buyer: { email: "buyer@example.com" },
  item: { name: "Fridge", quantity: 1, unitPrice: 1200000, currency: "TZS" },
  terms: {
    totalPayable: 1200000,
    depositAmount: 300000,
    installmentCount: 6,
    installmentAmount: 150000,
    frequency: "MONTHLY",
    possessionModel: "AFTER_FULL_PAYMENT",
    gracePeriodDays: 0,
    latePaymentPolicy: "None",
  },
  schedule: [{ sequence: 1, dueDate: "2026-12-15T00:00:00.000Z", amount: 150000 }],
};

describe("Phase 10 I6 — versioned contracts", () => {
  it("renders and hashes a contract from the frozen snapshot", () => {
    const body = buildContractBody(snapshot);
    expect(body).toContain("Example Shop");
    expect(body).toContain("buyer@example.com");
    expect(body).toContain("AFTER_FULL_PAYMENT");
    expect(hashContractBody(body)).toBe(hashContractBody(body));
    expect(hashContractBody(body)).not.toBe(hashContractBody(`${body} changed`));
  });

  it("validates document and financing input", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      createInstallmentDocumentSchema.safeParse({ businessId: id, agreementId: id }).success,
    ).toBe(true);
    expect(
      signInstallmentDocumentSchema.safeParse({ businessId: "", documentId: id }).success,
    ).toBe(true);
    expect(
      submitInstallmentFinancingSchema.safeParse({
        businessId: id,
        agreementId: id,
        partnerCode: "PARTNER-A",
        requestedAmount: "500000",
      }).success,
    ).toBe(true);
  });
});

describe("Phase 10 I7 — advanced reporting", () => {
  const schedules = [
    {
      dueDate: new Date(now.getTime() - 5 * DAY_MS),
      amountMinor: 100_00,
      paidMinor: 0,
      paidAt: null,
    },
    {
      dueDate: new Date(now.getTime() - 45 * DAY_MS),
      amountMinor: 100_00,
      paidMinor: 0,
      paidAt: null,
    },
    {
      dueDate: new Date(now.getTime() - 90 * DAY_MS),
      amountMinor: 100_00,
      paidMinor: 0,
      paidAt: null,
    },
    {
      dueDate: new Date(now.getTime() + 20 * DAY_MS),
      amountMinor: 100_00,
      paidMinor: 0,
      paidAt: null,
    },
    {
      dueDate: new Date(now.getTime() - 10 * DAY_MS),
      amountMinor: 100_00,
      paidMinor: 100_00,
      paidAt: new Date(now.getTime() + 5 * DAY_MS),
    },
    {
      dueDate: new Date(now.getTime() - 20 * DAY_MS),
      amountMinor: 100_00,
      paidMinor: 100_00,
      paidAt: new Date(now.getTime() - 20 * DAY_MS),
    },
  ];

  it("buckets unpaid amounts by days overdue", () => {
    const aging = buildAgingReport(schedules, now);
    expect(aging.days1To30Minor).toBe(100_00);
    expect(aging.days31To60Minor).toBe(100_00);
    expect(aging.over60Minor).toBe(100_00);
    expect(aging.currentMinor).toBe(100_00);
  });

  it("forecasts only unpaid amounts within each horizon", () => {
    const forecast = buildCollectionForecast(schedules, now);
    expect(forecast.next30Minor).toBe(400_00);
    expect(forecast.next60Minor).toBe(400_00);
    expect(forecast.next90Minor).toBe(400_00);
  });

  it("computes on-time rate, average lateness and completion/default rates", () => {
    const kpis = buildRepaymentKpis(schedules, ["COMPLETED", "ACTIVE", "DEFAULTED", "ACTIVE"]);
    expect(kpis.settledCount).toBe(2);
    expect(kpis.onTimeCount).toBe(1);
    expect(kpis.onTimeRate).toBe(50);
    expect(kpis.averageDaysLate).toBe(15);
    expect(kpis.completionRate).toBe(25);
    expect(kpis.defaultRate).toBe(25);
  });
});
