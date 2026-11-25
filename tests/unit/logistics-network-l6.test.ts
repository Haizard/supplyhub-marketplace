import { describe, expect, it } from "vitest";

import { haversineKm } from "@/features/logistics/dispatch";
import {
  pickCompanyDriver,
  scoreCompanyDriver,
} from "@/features/logistics-company-dispatch/scoring";
import { jobStatusSchema, reassignSchema } from "@/features/logistics-company-dispatch/validation";

const companyId = "00000000-0000-4000-8000-000000000001";
const membershipId = "00000000-0000-4000-8000-000000000002";

describe("Phase 9 L6 — company dispatch scoring", () => {
  const base = {
    membershipId,
    distanceKm: 0,
    rating: 4,
    completedTrips: 10,
    inServiceArea: true,
    hasVehicle: true,
    activeJobs: 0,
    capacity: 3,
  };

  it("requires a vehicle, coverage and free capacity", () => {
    expect(scoreCompanyDriver(base).eligible).toBe(true);
    expect(scoreCompanyDriver({ ...base, hasVehicle: false }).eligible).toBe(false);
    expect(scoreCompanyDriver({ ...base, inServiceArea: false }).eligible).toBe(false);
    expect(scoreCompanyDriver({ ...base, activeJobs: 3 }).eligible).toBe(false);
  });

  it("picks the highest scoring eligible driver", () => {
    const winner = pickCompanyDriver([
      { ...base, membershipId: "a", rating: 3 },
      { ...base, membershipId: "b", rating: 5 },
      { ...base, membershipId: "c", rating: 5, hasVehicle: false },
    ]);
    expect(winner?.membershipId).toBe("b");
  });

  it("uses the same haversine distance as platform dispatch", () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
    expect(
      haversineKm({ latitude: -6.8, longitude: 39.2 }, { latitude: -6.7, longitude: 39.2 }),
    ).toBeGreaterThan(0);
  });
});

describe("Phase 9 L6 — validation", () => {
  it("accepts a job status transition from the shared lifecycle", () => {
    expect(
      jobStatusSchema.safeParse({ companyId, jobId: membershipId, toStatus: "TO_PICKUP" }).success,
    ).toBe(true);
  });

  it("rejects reassignment to the same company-less schema shape", () => {
    expect(reassignSchema.safeParse({ companyId, jobId: membershipId, membershipId }).success).toBe(
      true,
    );
    expect(reassignSchema.safeParse({ companyId, jobId: membershipId }).success).toBe(false);
  });
});
