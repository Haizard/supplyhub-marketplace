import { describe, expect, it } from "vitest";

import {
  acceptedWeightKg,
  canTransitionStorage,
  deliveryFeeMinor,
  isEligibleLogisticsCompany,
  storageCapacityAvailable,
} from "@/features/agriculture/logistics-rules";
import {
  agriculturalDeliverySchema,
  intakeSchema,
  storageBookingSchema,
} from "@/features/agriculture/logistics-validation";

describe("Phase 11 D — agricultural logistics", () => {
  it("only allows platform-approved logistics companies", () => {
    expect(isEligibleLogisticsCompany("APPROVED")).toBe(true);
    expect(isEligibleLogisticsCompany("PENDING")).toBe(false);
    expect(isEligibleLogisticsCompany("SUSPENDED")).toBe(false);
  });

  it("computes a configurable delivery fee in minor units", () => {
    expect(deliveryFeeMinor(0)).toBe(500_000);
    expect(deliveryFeeMinor(10)).toBe(700_000);
    expect(deliveryFeeMinor(-5)).toBe(500_000);
  });

  it("records accepted weight after rejection", () => {
    expect(acceptedWeightKg(1000, 50)).toBe(950);
    expect(acceptedWeightKg(1000, 1200)).toBe(0);
  });

  it("prevents over-promising storage capacity", () => {
    expect(storageCapacityAvailable(1000, 400, 600)).toBe(true);
    expect(storageCapacityAvailable(1000, 400, 601)).toBe(false);
    expect(storageCapacityAvailable(1000, 1000, 0)).toBe(false);
  });

  it("enforces storage status transitions", () => {
    expect(canTransitionStorage("HELD", "STORED")).toBe(true);
    expect(canTransitionStorage("STORED", "RELEASED")).toBe(true);
    expect(canTransitionStorage("RELEASED", "STORED")).toBe(false);
  });

  it("validates delivery, intake and booking forms", () => {
    expect(
      agriculturalDeliverySchema.safeParse({
        companyId: "11111111-1111-4111-8111-111111111111",
        cargoType: "PRODUCE",
        direction: "FARM_TO_BUYER",
        quantity: "500",
        unit: "KG",
        pickupName: "Farm",
        pickupAddress: "Arusha",
        pickup: { latitude: "-6.8", longitude: "39.2" },
        dropoffName: "Buyer",
        dropoffAddress: "Dar es Salaam",
        dropoff: { latitude: "-6.75", longitude: "39.25" },
      }).success,
    ).toBe(true);
    expect(
      intakeSchema.safeParse({
        centreId: "11111111-1111-4111-8111-111111111111",
        weighedKg: "1000",
        rejectedKg: "20",
        grade: "A",
      }).success,
    ).toBe(true);
    expect(
      storageBookingSchema.safeParse({
        facilityId: "11111111-1111-4111-8111-111111111111",
        quantityKg: "500",
      }).success,
    ).toBe(true);
  });
});
