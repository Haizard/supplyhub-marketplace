import { describe, expect, it } from "vitest";

import {
  canRecordHarvest,
  harvestTotalKg,
  productionCostPerKgMinor,
} from "@/features/agriculture/farm-rules";
import { cropSchema, expenseSchema, harvestSchema } from "@/features/agriculture/farm-validation";

describe("Phase 11 C — farm management", () => {
  it("computes production cost per kilogram from expenses and harvested weight", () => {
    expect(
      productionCostPerKgMinor([10_000_000, 20_000_000, 15_000_000, 5_000_000, 5_000_000], 1000),
    ).toBe(55_000);
    expect(productionCostPerKgMinor([55_000_00], 0)).toBeNull();
  });

  it("only allows harvesting active crops", () => {
    expect(canRecordHarvest("PLANTED")).toBe(true);
    expect(canRecordHarvest("GROWING")).toBe(true);
    expect(canRecordHarvest("HARVESTED")).toBe(true);
    expect(canRecordHarvest("PLANNED")).toBe(false);
    expect(canRecordHarvest("CANCELLED")).toBe(false);
  });

  it("sums harvest weights", () => {
    expect(harvestTotalKg([{ quantityKg: 100.5 }, { quantityKg: 20.25 }])).toBe(120.75);
  });

  it("validates crop, expense and harvest forms", () => {
    const farmId = "11111111-1111-4111-8111-111111111111";
    expect(
      cropSchema.safeParse({ farmId, cropName: "Maize", plantedAt: "2026-11-01" }).success,
    ).toBe(true);
    expect(
      expenseSchema.safeParse({
        category: "FERTILIZER",
        amount: "200000",
        currency: "TZS",
        occurredAt: "2026-11-05",
      }).success,
    ).toBe(true);
    expect(
      harvestSchema.safeParse({
        cropId: farmId,
        harvestedAt: "2027-02-01",
        quantity: "1000",
        unit: "KG",
      }).success,
    ).toBe(true);
  });
});
