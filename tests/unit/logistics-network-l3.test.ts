import { describe, expect, it } from "vitest";

import { canTransitionVehicle } from "@/features/logistics-fleet/status";
import { vehicleSchema } from "@/features/logistics-fleet/validation";
import { canTransitionMembership } from "@/features/logistics-drivers/status";
import { scheduleSchema } from "@/features/logistics-drivers/validation";

const companyId = "00000000-0000-4000-8000-000000000001";

describe("Phase 9 L3 — vehicle lifecycle", () => {
  it("allows service transitions but protects retired vehicles", () => {
    expect(canTransitionVehicle("ACTIVE", "MAINTENANCE")).toBe(true);
    expect(canTransitionVehicle("MAINTENANCE", "ACTIVE")).toBe(true);
    expect(canTransitionVehicle("ACTIVE", "RETIRED")).toBe(true);
    expect(canTransitionVehicle("RETIRED", "ACTIVE")).toBe(false);
  });

  it("accepts trucks and numeric capacity", () => {
    const parsed = vehicleSchema.safeParse({
      companyId,
      plate: "T 123 ABC",
      type: "TRUCK",
      ownership: "OWNED",
      capacityKg: "2500.50",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.capacityKg).toBe(2500.5);
  });
});

describe("Phase 9 L3 — driver membership lifecycle", () => {
  it("lets a driver move between companies through memberships", () => {
    expect(canTransitionMembership("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransitionMembership("SUSPENDED", "ACTIVE")).toBe(true);
    expect(canTransitionMembership("ACTIVE", "ENDED")).toBe(true);
    expect(canTransitionMembership("ENDED", "ACTIVE")).toBe(false);
  });
});

describe("Phase 9 L3 — schedule validation", () => {
  const base = { membershipId: companyId, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" };

  it("accepts a valid shift", () => {
    expect(scheduleSchema.safeParse(base).success).toBe(true);
  });

  it("rejects impossible times and days", () => {
    expect(scheduleSchema.safeParse({ ...base, startTime: "25:00" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, dayOfWeek: 7 }).success).toBe(false);
  });
});
