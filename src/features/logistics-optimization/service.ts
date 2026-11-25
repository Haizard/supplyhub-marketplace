import "server-only";

import { haversineKm } from "@/features/logistics/dispatch";
import type { CompanyDriverCandidate } from "@/features/logistics-company-dispatch/scoring";
import { getDatabase } from "@/server/db/client";

import type { OptimizationSignals } from "./types";

/** Documented configurable default, matching company dispatch. */
const DEFAULT_DRIVER_CAPACITY = 3;
const UNKNOWN_DISTANCE_KM = 25;

/** Builds only aggregate features from the company's own pending request. */
export async function buildOptimizationSignals(
  companyId: string,
  requestId: string,
): Promise<OptimizationSignals | null> {
  const database = getDatabase();
  const request = await database.deliveryRequest.findFirst({
    where: {
      id: requestId,
      companyId,
      source: "COMPANY",
      status: "PENDING",
    },
    select: {
      id: true,
      pickupLatitude: true,
      pickupLongitude: true,
      jobs: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
        select: { id: true },
      },
    },
  });
  if (!request || request.jobs.length > 0) return null;

  const pickup = {
    latitude: Number(request.pickupLatitude.toString()),
    longitude: Number(request.pickupLongitude.toString()),
  };

  const [memberships, settings, branches] = await Promise.all([
    database.driverCompanyMembership.findMany({
      where: { companyId, status: "ACTIVE" },
      select: {
        id: true,
        driver: { select: { rating: true } },
        assignments: { where: { status: "ACTIVE" }, select: { vehicleId: true } },
        jobs: {
          where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
          select: { id: true },
        },
        _count: { select: { jobs: { where: { status: "DELIVERED" } } } },
      },
    }),
    database.logisticsCompanySettings.findUnique({
      where: { companyId },
      select: { defaultServiceRadius: true },
    }),
    database.logisticsBranch.findMany({
      where: { companyId, isActive: true },
      select: { latitude: true, longitude: true },
    }),
  ]);

  const radius = Number(settings?.defaultServiceRadius ?? 15);
  const distances = branches
    .filter((branch) => branch.latitude !== null && branch.longitude !== null)
    .map((branch) =>
      haversineKm(pickup, {
        latitude: Number(branch.latitude!.toString()),
        longitude: Number(branch.longitude!.toString()),
      }),
    );
  const distanceKm =
    distances.length === 0 ? UNKNOWN_DISTANCE_KM : Math.round(Math.min(...distances) * 1000) / 1000;

  const candidates: CompanyDriverCandidate[] = memberships.map((membership) => ({
    membershipId: membership.id,
    distanceKm,
    rating: Number(membership.driver.rating.toString()),
    completedTrips: membership._count.jobs,
    inServiceArea: distanceKm <= radius,
    hasVehicle: membership.assignments.length > 0,
    activeJobs: membership.jobs.length,
    capacity: DEFAULT_DRIVER_CAPACITY,
  }));

  return { companyId, requestId: request.id, candidates };
}
