import { describe, expect, it } from "vitest";

import {
  agreementTotalMinor,
  canTransitionAgreement,
  isWithinTolerance,
  varianceKg,
  variancePercent,
} from "@/features/agriculture/group-rules";
import {
  farmerGroupSchema,
  harvestAgreementSchema,
  harvestDeliverySchema,
} from "@/features/agriculture/group-validation";

describe("Phase 11 E — groups and harvest agreements", () => {
  it("computes quantity variance and tolerance", () => {
    expect(varianceKg(1000, 960)).toBe(-40);
    expect(variancePercent(1000, 960)).toBe(4);
    expect(isWithinTolerance(1000, 960)).toBe(true);
    expect(isWithinTolerance(1000, 900)).toBe(false);
    expect(isWithinTolerance(1000, 940, 10)).toBe(true);
  });

  it("computes agreement totals in minor units", () => {
    expect(agreementTotalMinor(10, 1200)).toBe(1_200_000);
  });

  it("enforces agreement status transitions", () => {
    expect(canTransitionAgreement("DRAFT", "PENDING_FARMER")).toBe(true);
    expect(canTransitionAgreement("PENDING_FARMER", "ACCEPTED")).toBe(true);
    expect(canTransitionAgreement("ACCEPTED", "DELIVERED")).toBe(true);
    expect(canTransitionAgreement("ACCEPTED", "COMPLETED")).toBe(false);
    expect(canTransitionAgreement("DELIVERED", "COMPLETED")).toBe(true);
    expect(canTransitionAgreement("COMPLETED", "DELIVERED")).toBe(false);
  });

  it("validates group, agreement and delivery forms", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(farmerGroupSchema.safeParse({ name: "Ruvuma Farmers" }).success).toBe(true);
    expect(
      harvestAgreementSchema.safeParse({
        farmerId: id,
        cropName: "Maize",
        expectedQuantity: "10000",
        unit: "KG",
        currency: "TZS",
        deliveryDate: "2027-03-01",
        collectionLocation: "Ruvuma",
        paymentTerms: "Payment after verified delivery",
      }).success,
    ).toBe(true);
    expect(
      harvestDeliverySchema.safeParse({ agreementId: id, deliveredQuantity: "9600" }).success,
    ).toBe(true);
  });
});
