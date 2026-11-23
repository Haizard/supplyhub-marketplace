import { describe, expect, it } from "vitest";

import {
  calculateOrderTotals,
  makeDocumentNumber,
  resolveTierUnitPrice,
  totalFromCents,
  type DecimalLike,
} from "@/features/b2b/pricing";
import {
  canTransitionInvoice,
  canTransitionPurchaseOrder,
  canTransitionQuotation,
  canTransitionRfq,
} from "@/features/b2b/status";

const dec = (value: string): DecimalLike => ({ toString: () => value });

describe("wholesale pricing", () => {
  const tiers = [
    { minQty: 1, maxQty: 9, unitPrice: dec("10000") },
    { minQty: 10, maxQty: 49, unitPrice: dec("8500") },
    { minQty: 50, maxQty: null, unitPrice: dec("7000") },
  ];

  it("uses the base price below the first tier", () => {
    expect(resolveTierUnitPrice(1, dec("12000"), tiers)).toBe("10000");
  });

  it("applies volume tiers by quantity", () => {
    expect(resolveTierUnitPrice(10, dec("12000"), tiers)).toBe("8500");
    expect(resolveTierUnitPrice(50, dec("12000"), tiers)).toBe("7000");
    expect(resolveTierUnitPrice(500, dec("12000"), tiers)).toBe("7000");
  });

  it("rejects invalid quantities", () => {
    expect(() => resolveTierUnitPrice(0, dec("100"), tiers)).toThrow();
    expect(() => resolveTierUnitPrice(1.5, dec("100"), tiers)).toThrow();
  });

  it("multiplies integer cents exactly", () => {
    expect(totalFromCents(8500, 12)).toBe(102000);
  });

  it("aggregates order totals as decimal strings", () => {
    expect(
      calculateOrderTotals({
        items: [{ lineTotal: dec("102000.00") }, { lineTotal: dec("5000.50") }],
        taxCents: 5000,
        shippingCents: 2500,
      }),
    ).toEqual({
      subtotal: "107000.50",
      taxTotal: "50.00",
      shippingTotal: "25.00",
      total: "107075.50",
    });
  });

  it("generates prefixed document numbers", () => {
    expect(makeDocumentNumber("WL")).toMatch(/^WL-[A-Z0-9]+-[A-Z0-9]{4}$/);
  });
});

describe("B2B document lifecycles", () => {
  it("moves RFQs forward only", () => {
    expect(canTransitionRfq("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionRfq("SUBMITTED", "QUOTED")).toBe(true);
    expect(canTransitionRfq("ACCEPTED", "QUOTED")).toBe(false);
  });

  it("moves quotations forward only", () => {
    expect(canTransitionQuotation("DRAFT", "SENT")).toBe(true);
    expect(canTransitionQuotation("SENT", "ACCEPTED")).toBe(true);
    expect(canTransitionQuotation("ACCEPTED", "REJECTED")).toBe(false);
  });

  it("follows the purchase order path to received", () => {
    expect(canTransitionPurchaseOrder("SENT", "CONFIRMED")).toBe(true);
    expect(canTransitionPurchaseOrder("CONFIRMED", "PROCESSING")).toBe(true);
    expect(canTransitionPurchaseOrder("SHIPPED", "RECEIVED")).toBe(true);
    expect(canTransitionPurchaseOrder("PROCESSING", "RECEIVED")).toBe(false);
  });

  it("allows overdue invoices to be paid", () => {
    expect(canTransitionInvoice("ISSUED", "OVERDUE")).toBe(true);
    expect(canTransitionInvoice("OVERDUE", "PAID")).toBe(true);
    expect(canTransitionInvoice("PAID", "ISSUED")).toBe(false);
  });
});
