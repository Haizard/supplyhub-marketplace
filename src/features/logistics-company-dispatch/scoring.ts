import { haversineKm, type GeoPoint } from "@/features/logistics/dispatch";

/** Company dispatch weights mirror the platform scorer; documented defaults. */
export const COMPANY_DISPATCH_WEIGHTS = {
  proximity: 40,
  rating: 20,
  experience: 15,
  serviceArea: 15,
  availability: 10,
} as const;

export interface CompanyDriverCandidate {
  membershipId: string;
  distanceKm: number;
  rating: number;
  completedTrips: number;
  inServiceArea: boolean;
  hasVehicle: boolean;
  activeJobs: number;
  capacity: number;
}

export interface ScoredCompanyDriver extends CompanyDriverCandidate {
  score: number;
  eligible: boolean;
}

const MAX_SCORE_DISTANCE_KM = 25;

export function scoreCompanyDriver(candidate: CompanyDriverCandidate): ScoredCompanyDriver {
  const eligible =
    candidate.activeJobs < candidate.capacity && candidate.hasVehicle && candidate.inServiceArea;
  const proximity =
    COMPANY_DISPATCH_WEIGHTS.proximity *
    Math.max(0, 1 - candidate.distanceKm / MAX_SCORE_DISTANCE_KM);
  const rating = COMPANY_DISPATCH_WEIGHTS.rating * (Math.min(5, Math.max(0, candidate.rating)) / 5);
  const experience =
    COMPANY_DISPATCH_WEIGHTS.experience * Math.min(1, candidate.completedTrips / 50);
  const serviceArea = candidate.inServiceArea ? COMPANY_DISPATCH_WEIGHTS.serviceArea : 0;
  const availability =
    candidate.activeJobs < candidate.capacity ? COMPANY_DISPATCH_WEIGHTS.availability : 0;
  const score = proximity + rating + experience + serviceArea + availability;
  return {
    ...candidate,
    score: Math.round(score * 1000) / 1000,
    eligible,
  };
}

export function pickCompanyDriver(
  candidates: CompanyDriverCandidate[],
): ScoredCompanyDriver | null {
  const ranked = candidates
    .map(scoreCompanyDriver)
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => b.score - a.score || a.membershipId.localeCompare(b.membershipId));
  return ranked[0] ?? null;
}

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  return Math.round(haversineKm(from, to) * 1000) / 1000;
}
