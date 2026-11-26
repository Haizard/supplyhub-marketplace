import { describe, expect, it } from "vitest";

import { contractTotalMinor, requestIsOpen, validateOffer } from "@/features/agriculture/rules";
import { buyerRequestSchema, listingSchema } from "@/features/agriculture/validation";

const listing = {
  quantity: 5000,
  unit: "KG",
  minimumOrder: 500,
  status: "PUBLISHED",
  currency: "TZS",
};
const request = {
  quantity: 2000,
  unit: "KG",
  offerDeadline: new Date("2026-12-01T00:00:00.000Z"),
  status: "OPEN",
};
const offer = { quantity: 1000, unit: "KG", pricePerUnit: 1200, currency: "TZS" };

describe("Phase 11 A — agricultural trade rules", () => {
  it("accepts a valid offer against a published listing", () => {
    expect(validateOffer(listing, request, offer)).toEqual({ ok: true });
  });

  it("rejects mismatched units, currencies and quantities", () => {
    expect(validateOffer(listing, request, { ...offer, unit: "BAG" }).ok).toBe(false);
    expect(validateOffer(listing, request, { ...offer, currency: "USD" }).ok).toBe(false);
    expect(validateOffer(listing, request, { ...offer, quantity: 100 }).ok).toBe(false);
    expect(validateOffer(listing, request, { ...offer, quantity: 6000 }).ok).toBe(false);
    expect(validateOffer(listing, { ...request, quantity: 500 }, offer).ok).toBe(false);
    expect(validateOffer({ ...listing, status: "DRAFT" }, request, offer).ok).toBe(false);
  });

  it("closes requests after the offer deadline", () => {
    expect(requestIsOpen(request, new Date("2026-11-25T00:00:00.000Z"))).toBe(true);
    expect(requestIsOpen(request, new Date("2026-12-02T00:00:00.000Z"))).toBe(false);
    expect(requestIsOpen({ ...request, status: "CLOSED" })).toBe(false);
  });

  it("computes contract totals in integer minor units", () => {
    expect(contractTotalMinor(1000, 1200)).toBe(1_200_000_00);
    expect(contractTotalMinor(3, 333.33)).toBe(99999);
  });

  it("validates listing and buyer request forms", () => {
    expect(
      listingSchema.safeParse({
        cropName: "Maize",
        quantity: "5000",
        unit: "KG",
        pricePerUnit: "1200",
        currency: "TZS",
        minimumOrder: "500",
        collectionLocation: "Arusha",
      }).success,
    ).toBe(true);
    expect(
      buyerRequestSchema.safeParse({
        productName: "Sunflower",
        quantity: "50",
        unit: "TONNE",
        deliveryLocation: "Factory",
        deliveryDeadline: "2027-01-01",
        offerDeadline: "2026-12-01",
      }).success,
    ).toBe(true);
  });
});
