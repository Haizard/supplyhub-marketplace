import { describe, expect, it } from "vitest";

import {
  canReleaseHandover,
  evaluateShareActivation,
  hubHasCapacity,
  isInsuranceCurrent,
  pickupCodeMatches,
  windowsOverlap,
  type ShareActivationInput,
} from "@/features/logistics-sharing/rules";
import {
  hubReleaseSchema,
  hubSchema,
  shareOfferSchema,
} from "@/features/logistics-sharing/validation";

const now = new Date("2026-11-25T00:00:00.000Z");
const future = new Date("2027-01-01T00:00:00.000Z");
const past = new Date("2025-01-01T00:00:00.000Z");

function validInput(): ShareActivationInput {
  return {
    status: "PENDING_PARTNER",
    ownerApproved: true,
    partnerApproved: true,
    ownerConsentedAt: past,
    partnerConsentedAt: past,
    insurancePolicyRef: "POL-123",
    insuranceExpiresAt: future,
    effectiveFrom: past,
    effectiveTo: future,
    accountableIsParty: true,
    vehicles: [
      {
        plate: "T123ABC",
        status: "ACTIVE",
        insuranceExpiresAt: future,
        committedElsewhere: false,
      },
    ],
  };
}

describe("Phase 9 L11 — fleet sharing activation", () => {
  it("activates only when consent, approval, insurance, vehicles and accountability are valid", () => {
    expect(evaluateShareActivation(validInput(), now)).toEqual({ ok: true });
  });

  it("requires both consents and platform approval", () => {
    expect(
      evaluateShareActivation({ ...validInput(), partnerConsentedAt: null }, now),
    ).toMatchObject({ ok: false });
    expect(evaluateShareActivation({ ...validInput(), ownerApproved: false }, now)).toMatchObject({
      ok: false,
    });
  });

  it("rejects missing or expired insurance", () => {
    expect(
      evaluateShareActivation({ ...validInput(), insurancePolicyRef: null }, now),
    ).toMatchObject({ ok: false });
    expect(
      evaluateShareActivation({ ...validInput(), insuranceExpiresAt: past }, now),
    ).toMatchObject({ ok: false });
    expect(isInsuranceCurrent(null, now)).toBe(false);
    expect(isInsuranceCurrent(future, now)).toBe(true);
  });

  it("rejects an accountable company outside the two parties", () => {
    expect(
      evaluateShareActivation({ ...validInput(), accountableIsParty: false }, now),
    ).toMatchObject({ ok: false });
  });

  it("rejects empty pools, inactive vehicles and vehicles committed elsewhere", () => {
    expect(evaluateShareActivation({ ...validInput(), vehicles: [] }, now)).toMatchObject({
      ok: false,
    });
    expect(
      evaluateShareActivation(
        {
          ...validInput(),
          vehicles: [{ ...validInput().vehicles[0]!, status: "MAINTENANCE" }],
        },
        now,
      ),
    ).toMatchObject({ ok: false });
    expect(
      evaluateShareActivation(
        {
          ...validInput(),
          vehicles: [{ ...validInput().vehicles[0]!, insuranceExpiresAt: past }],
        },
        now,
      ),
    ).toMatchObject({ ok: false });
    expect(
      evaluateShareActivation(
        {
          ...validInput(),
          vehicles: [{ ...validInput().vehicles[0]!, committedElsewhere: true }],
        },
        now,
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects expired or inverted effective windows", () => {
    expect(evaluateShareActivation({ ...validInput(), effectiveTo: past }, now)).toMatchObject({
      ok: false,
    });
    expect(
      evaluateShareActivation({ ...validInput(), effectiveFrom: future, effectiveTo: past }, now),
    ).toMatchObject({ ok: false });
  });

  it("detects overlapping agreement windows", () => {
    expect(
      windowsOverlap(
        { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-06-01T00:00:00Z") },
        { from: new Date("2026-05-01T00:00:00Z"), to: new Date("2026-12-01T00:00:00Z") },
      ),
    ).toBe(true);
    expect(
      windowsOverlap(
        { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-03-01T00:00:00Z") },
        { from: new Date("2026-06-01T00:00:00Z"), to: null },
      ),
    ).toBe(false);
  });
});

describe("Phase 9 L11 — parcel hub custody", () => {
  it("enforces declared capacity", () => {
    expect(hubHasCapacity(0, 1)).toBe(true);
    expect(hubHasCapacity(1, 1)).toBe(false);
    expect(hubHasCapacity(0, 0)).toBe(false);
  });

  it("checks pickup codes in constant time and ignores surrounding whitespace", () => {
    expect(pickupCodeMatches("123456", "123456")).toBe(true);
    expect(pickupCodeMatches("123456", " 123456 ")).toBe(true);
    expect(pickupCodeMatches("123456", "654321")).toBe(false);
    expect(pickupCodeMatches("123456", "12345")).toBe(false);
  });

  it("releases a parcel only once", () => {
    expect(canReleaseHandover("STORED", null)).toBe(true);
    expect(canReleaseHandover("STORED", new Date())).toBe(false);
    expect(canReleaseHandover("RELEASED", null)).toBe(false);
  });

  it("validates hub and release forms", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    expect(
      hubSchema.safeParse({
        companyId,
        hubCode: "DAR-01",
        name: "Dar hub",
        address: "12 Main St",
        capacity: "50",
      }).success,
    ).toBe(true);
    expect(
      hubSchema.safeParse({
        companyId,
        hubCode: "bad code",
        name: "Dar hub",
        address: "12 Main St",
        capacity: "50",
      }).success,
    ).toBe(false);
    expect(
      hubReleaseSchema.safeParse({
        companyId,
        handoverId: "22222222-2222-4222-8222-222222222222",
        pickupCode: "12ab56",
        releasedToName: "Amina",
      }).success,
    ).toBe(false);
  });

  it("validates sharing offers and rejects expired insurance or inverted dates", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const vehicleId = "22222222-2222-4222-8222-222222222222";
    const base = {
      companyId,
      partnerCompanyCode: "LC-ABCD",
      type: "VEHICLE_LENDING",
      accountable: "PARTNER",
      insurancePolicyRef: "POL-1",
      insuranceExpiresAt: "2027-01-01",
      effectiveFrom: "2026-11-01",
      effectiveTo: "2026-12-01",
      vehicleIds: [vehicleId],
    };
    expect(shareOfferSchema.safeParse(base).success).toBe(true);
    expect(shareOfferSchema.safeParse({ ...base, insuranceExpiresAt: "2025-01-01" }).success).toBe(
      false,
    );
    expect(shareOfferSchema.safeParse({ ...base, effectiveTo: "2026-10-01" }).success).toBe(false);
    expect(shareOfferSchema.safeParse({ ...base, vehicleIds: [] }).success).toBe(false);
  });
});
