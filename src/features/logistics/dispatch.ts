/**
 * Pure geography and dispatch helpers. Kept free of database imports so the
 * scoring rules can be unit tested without PostgreSQL.
 */

const EARTH_RADIUS_KM = 6371;
const RAD = Math.PI / 180;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.latitude - a.latitude) * RAD;
  const dLng = (b.longitude - a.longitude) * RAD;
  const lat1 = a.latitude * RAD;
  const lat2 = b.latitude * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface DispatchCandidate {
  agentId: string;
  /** Distance from the agent's last known position to the pickup, in km. */
  distanceKm: number;
  /** 0..5, higher is better. */
  rating: number;
  /** Number of completed trips. */
  completedTrips: number;
  /** Whether the agent has a service area covering the pickup. */
  inServiceArea: boolean;
  /** Maximum simultaneous active jobs for this agent. */
  capacity: number;
  /** Currently active job count. */
  activeJobs: number;
}

export interface ScoredCandidate extends DispatchCandidate {
  score: number;
  eligible: boolean;
}

/**
 * Deterministic dispatch score. Higher wins. An agent is ineligible when at
 * capacity. The weights are a documented configurable default; the roadmap
 * leaves business policy unresolved rather than inventing a hard rule.
 */
export const DISPATCH_WEIGHTS = {
  proximity: 40,
  rating: 20,
  experience: 15,
  serviceArea: 15,
  availability: 10,
} as const;

const MAX_SCORE_DISTANCE_KM = 25;

export function scoreCandidate(candidate: DispatchCandidate): ScoredCandidate {
  const eligible = candidate.activeJobs < candidate.capacity;
  const proximity =
    DISPATCH_WEIGHTS.proximity * Math.max(0, 1 - candidate.distanceKm / MAX_SCORE_DISTANCE_KM);
  const rating = DISPATCH_WEIGHTS.rating * (Math.min(5, Math.max(0, candidate.rating)) / 5);
  const experience = DISPATCH_WEIGHTS.experience * Math.min(1, candidate.completedTrips / 50);
  const serviceArea = candidate.inServiceArea ? DISPATCH_WEIGHTS.serviceArea : 0;
  const availability = eligible ? DISPATCH_WEIGHTS.availability : 0;

  const score = proximity + rating + experience + serviceArea + availability;

  return {
    ...candidate,
    score: Math.round(score * 1000) / 1000,
    eligible,
  };
}

/** Picks the highest-scoring eligible agent, or null when nobody qualifies. */
export function pickBestAgent(candidates: DispatchCandidate[]): ScoredCandidate | null {
  const ranked = candidates
    .map(scoreCandidate)
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId));
  return ranked[0] ?? null;
}
