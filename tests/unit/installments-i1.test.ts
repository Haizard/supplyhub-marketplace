import { describe, expect, it } from "vitest";

import {
  calculateInstallmentTerms,
  InstallmentTermsError,
  scheduleTotal,
} from "@/features/installments/rules";
import {
  createInstallmentAgreementSchema,
  installmentSettingsSchema,
} from "@/features/installments/validation";

const base = {
  cashPrice: 1_200_000,
  interestAmount: 0,
  extraCharges: 0,
  depositMode: "PERCENTAGE" as const,
  depositValue: 25,
  frequency: "MONTHLY" as const,
  installmentCount: 6,
  firstDueDate: new Date("2026-12-15T00:00:00.000Z"),
};

describe("Phase 10 I1 — installment terms", () => {
  it("generates the six-month refrigerator example exactly", () => {
    const terms = calculateInstallmentTerms(base);
    expect(terms.depositAmount).toBe(300_000);
    expect(terms.totalPayable).toBe(1_200_000);
    expect(terms.outstandingBalance).toBe(900_000);
    expect(terms.installmentAmount).toBe(150_000);
    expect(terms.schedule).toHaveLength(6);
    expect(terms.schedule.map((entry) => entry.amount)).toEqual(Array(6).fill(150_000));
    expect(scheduleTotal(terms.schedule)).toBe(terms.outstandingBalance);
    expect(terms.schedule[0]?.dueDate.toISOString()).toBe("2027-01-15T00:00:00.000Z");
    expect(terms.schedule[5]?.dueDate.toISOString()).toBe("2027-06-15T00:00:00.000Z");
  });

  it("places the rounding remainder on the final instalment", () => {
    const terms = calculateInstallmentTerms({
      ...base,
      cashPrice: 1_001,
      depositMode: "FIXED",
      depositValue: 1,
      installmentCount: 3,
    });
    expect(terms.outstandingBalance).toBe(1_000);
    expect(terms.schedule.map((entry) => entry.amount)).toEqual([333.33, 333.33, 333.34]);
    expect(scheduleTotal(terms.schedule)).toBe(1_000);
  });

  it("clamps monthly due dates to the end of shorter months", () => {
    const terms = calculateInstallmentTerms({
      ...base,
      cashPrice: 1_000,
      depositMode: "FIXED",
      depositValue: 100,
      installmentCount: 1,
      firstDueDate: new Date("2027-01-31T00:00:00.000Z"),
    });
    expect(terms.schedule[0]?.dueDate.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("rejects invalid deposits and installment counts", () => {
    expect(() => calculateInstallmentTerms({ ...base, depositValue: 100 })).toThrow(
      InstallmentTermsError,
    );
    expect(() =>
      calculateInstallmentTerms({ ...base, depositMode: "FIXED", depositValue: 1_200_000 }),
    ).toThrow(InstallmentTermsError);
    expect(() => calculateInstallmentTerms({ ...base, installmentCount: 0 })).toThrow(
      InstallmentTermsError,
    );
  });
});

describe("Phase 10 I1 — server-boundary validation", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";

  it("validates agreement creation input", () => {
    expect(
      createInstallmentAgreementSchema.safeParse({
        businessId,
        buyerEmail: "buyer@example.com",
        source: "OFFLINE",
        itemName: "Refrigerator",
        productId: "33333333-3333-4333-8333-333333333333",
        quantity: "1",
        unitPrice: "1200000",
        depositMode: "PERCENTAGE",
        depositValue: "25",
        frequency: "MONTHLY",
        installmentCount: "6",
        possessionModel: "IMMEDIATE",
        firstDueDate: "2026-12-15",
      }).success,
    ).toBe(true);
    expect(
      createInstallmentAgreementSchema.safeParse({
        businessId,
        buyerEmail: "not-an-email",
        source: "OFFLINE",
        itemName: "Refrigerator",
        productId: "33333333-3333-4333-8333-333333333333",
        quantity: "1",
        unitPrice: "1200000",
        depositMode: "PERCENTAGE",
        depositValue: "25",
        frequency: "MONTHLY",
        installmentCount: "6",
        possessionModel: "IMMEDIATE",
        firstDueDate: "2026-12-15",
      }).success,
    ).toBe(false);
  });

  it("validates seller settings, including policy switches", () => {
    expect(
      installmentSettingsSchema.safeParse({
        businessId,
        enabled: "true",
        currency: "TZS",
        defaultDepositMode: "PERCENTAGE",
        defaultDepositValue: "20",
        defaultFrequency: "MONTHLY",
        defaultInstallmentCount: "6",
        defaultPossession: "AFTER_FULL_PAYMENT",
        gracePeriodDays: "0",
        maxInstallments: "24",
        allowInterest: "false",
        allowLateFees: "false",
        allowAdvancePayments: "false",
        termsSummary: "",
      }).success,
    ).toBe(true);
  });
});
