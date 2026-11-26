import { describe, expect, it } from "vitest";

import {
  bookingsOverlap,
  canPublishInput,
  canPublishService,
  canTransitionBooking,
  inputOrderTotalMinor,
} from "@/features/agriculture/supplier-rules";
import { inputSchema, serviceSchema } from "@/features/agriculture/supplier-validation";

describe("Phase 11 B — verified inputs and services", () => {
  it("requires verification and registration for regulated inputs", () => {
    const verified = { verificationStatus: "VERIFIED", supplierType: "BOTH" };
    expect(
      canPublishInput({ ...verified, category: "MANURE_COMPOST", registrationRef: null }).ok,
    ).toBe(true);
    expect(canPublishInput({ ...verified, category: "FERTILIZER", registrationRef: null }).ok).toBe(
      false,
    );
    expect(
      canPublishInput({ ...verified, category: "FERTILIZER", registrationRef: "REG-1" }).ok,
    ).toBe(true);
    expect(
      canPublishInput({
        ...verified,
        verificationStatus: "PENDING",
        category: "SEED",
        registrationRef: "R",
      }).ok,
    ).toBe(false);
    expect(
      canPublishInput({
        ...verified,
        supplierType: "SERVICE",
        category: "SEED",
        registrationRef: "R",
      }).ok,
    ).toBe(false);
  });

  it("requires qualifications for advisory and spraying services", () => {
    const verified = { verificationStatus: "VERIFIED", supplierType: "BOTH" };
    expect(
      canPublishService({ ...verified, serviceType: "TRACTOR", qualificationRef: null }).ok,
    ).toBe(true);
    expect(
      canPublishService({ ...verified, serviceType: "SPRAYING", qualificationRef: null }).ok,
    ).toBe(false);
    expect(
      canPublishService({ ...verified, serviceType: "AGRONOMY", qualificationRef: "Q-1" }).ok,
    ).toBe(true);
    expect(
      canPublishService({
        ...verified,
        supplierType: "INPUT",
        serviceType: "TRACTOR",
        qualificationRef: null,
      }).ok,
    ).toBe(false);
  });

  it("enforces booking state transitions", () => {
    expect(canTransitionBooking("REQUESTED", "QUOTED")).toBe(true);
    expect(canTransitionBooking("QUOTED", "CONFIRMED")).toBe(true);
    expect(canTransitionBooking("CONFIRMED", "COMPLETED")).toBe(false);
    expect(canTransitionBooking("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransitionBooking("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("detects overlapping provider bookings", () => {
    const day = 24 * 60 * 60 * 1000;
    const a = { start: new Date("2026-12-01T00:00:00Z"), end: new Date("2026-12-02T00:00:00Z") };
    expect(
      bookingsOverlap(a, {
        start: new Date(a.start.getTime() + 12 * 60 * 60 * 1000),
        end: new Date(a.start.getTime() + day + day),
      }),
    ).toBe(true);
    expect(
      bookingsOverlap(a, {
        start: new Date(a.end.getTime()),
        end: new Date(a.end.getTime() + day),
      }),
    ).toBe(false);
  });

  it("computes input order totals in minor units and validates forms", () => {
    expect(inputOrderTotalMinor(2, 300_000)).toBe(60_000_000);
    expect(
      inputSchema.safeParse({
        name: "Compost",
        category: "MANURE_COMPOST",
        quantity: "10",
        unit: "BAG",
        pricePerUnit: "5000",
        currency: "TZS",
        minimumOrder: "1",
        treatmentStatus: "composted",
      }).success,
    ).toBe(true);
    expect(
      serviceSchema.safeParse({
        serviceType: "TRACTOR",
        title: "Land preparation",
        rateAmount: "80000",
        rateUnit: "per acre",
        currency: "TZS",
      }).success,
    ).toBe(true);
  });
});
