import { describe, expect, it } from "vitest";

import { canHoldStock, shouldConvertReservation } from "@/features/installments/stock-rules";
import { createInstallmentAgreementSchema } from "@/features/installments/validation";

describe("Phase 10 I4 — stock reservation rules", () => {
  it("requires both catalogue and warehouse stock to cover a hold", () => {
    expect(canHoldStock({ catalogueStock: 5, warehouseStock: 5, quantity: 3 })).toBe(true);
    expect(canHoldStock({ catalogueStock: 2, warehouseStock: 5, quantity: 3 })).toBe(false);
    expect(canHoldStock({ catalogueStock: 5, warehouseStock: 1, quantity: 3 })).toBe(false);
    expect(canHoldStock({ catalogueStock: 5, warehouseStock: 5, quantity: 0 })).toBe(false);
  });

  it("converts held units to a sale only when possession terms are met", () => {
    expect(shouldConvertReservation("IMMEDIATE", "ACTIVE")).toBe(true);
    expect(shouldConvertReservation("IMMEDIATE", "PENDING_DEPOSIT")).toBe(false);
    expect(shouldConvertReservation("AFTER_FULL_PAYMENT", "COMPLETED")).toBe(true);
    expect(shouldConvertReservation("AFTER_FULL_PAYMENT", "ACTIVE")).toBe(false);
    expect(shouldConvertReservation("AFTER_FULL_PAYMENT", "OVERDUE")).toBe(false);
  });

  it("accepts a POS agreement with a real product and a catalogue-authoritative price", () => {
    const businessId = "11111111-1111-4111-8111-111111111111";
    const parsed = createInstallmentAgreementSchema.safeParse({
      businessId,
      buyerEmail: "buyer@example.com",
      source: "OFFLINE",
      itemName: "Refrigerator",
      productId: "33333333-3333-4333-8333-333333333333",
      quantity: "1",
      unitPrice: "0",
      depositMode: "PERCENTAGE",
      depositValue: "25",
      frequency: "MONTHLY",
      installmentCount: "6",
      possessionModel: "AFTER_FULL_PAYMENT",
      firstDueDate: "2026-12-15",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.productId).toBe("33333333-3333-4333-8333-333333333333");
  });
});
