import { haversineKm, type GeoPoint } from "@/features/logistics/dispatch";

/** Eligibility and ranking weights for offering a job to a logistics company. */
export const MARKETPLACE_WEIGHTS = {
  coverage: 30,
  capacity: 20,
  vehicle: 20,
  reliability: 20,
  price: 10,
} as const;

export interface CompanyOfferCandidate {
  companyId: string;
  verified: boolean;
  active: boolean;
  coverageKm: number | null;
  distanceKm: number;
  capacityCount: number;
  vehicleMatch: boolean;
  reliabilityBps: number;
  priceScoreBps: number;
}

export interface ScoredCompanyOffer extends CompanyOfferCandidate {
  score: number;
  eligible: boolean;
}

const MAX_COVERAGE_DISTANCE = 50;
const MAX_SCORE_CAPACITY = 5;

export function scoreCompanyOffer(candidate: CompanyOfferCandidate): ScoredCompanyOffer {
  const eligible =
    candidate.verified &&
    candidate.active &&
    candidate.vehicleMatch &&
    candidate.capacityCount > 0 &&
    candidate.coverageKm !== null &&
    candidate.distanceKm <= candidate.coverageKm;

  const coverage =
    candidate.coverageKm === null
      ? 0
      : MARKETPLACE_WEIGHTS.coverage *
        Math.max(
          0,
          1 - candidate.distanceKm / Math.min(MAX_COVERAGE_DISTANCE, candidate.coverageKm),
        );
  const capacity =
    MARKETPLACE_WEIGHTS.capacity * Math.min(1, candidate.capacityCount / MAX_SCORE_CAPACITY);
  const vehicle = candidate.vehicleMatch ? MARKETPLACE_WEIGHTS.vehicle : 0;
  const reliability = MARKETPLACE_WEIGHTS.reliability * (candidate.reliabilityBps / 10_000);
  const price = MARKETPLACE_WEIGHTS.price * (candidate.priceScoreBps / 10_000);
  const score = Math.round((coverage + capacity + vehicle + reliability + price) * 1000) / 1000;

  return { ...candidate, score, eligible };
}

export function rankCompanyOffers(candidates: CompanyOfferCandidate[]): ScoredCompanyOffer[] {
  return candidates
    .map(scoreCompanyOffer)
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => b.score - a.score || a.companyId.localeCompare(b.companyId));
}

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  return Math.round(haversineKm(from, to) * 1000) / 1000;
}
