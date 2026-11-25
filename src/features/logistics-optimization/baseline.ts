import { createHash } from "node:crypto";

import { scoreCompanyDriver } from "@/features/logistics-company-dispatch/scoring";

import type { OptimizationSignals, RankedCandidate } from "./types";

/** Deterministic baseline: score then stable ID tie-breaker. Never uses a model. */
export function rankBaseline(signals: OptimizationSignals): RankedCandidate[] {
  return signals.candidates
    .map(scoreCompanyDriver)
    .sort((a, b) => b.score - a.score || a.membershipId.localeCompare(b.membershipId))
    .map((candidate) => ({
      membershipId: candidate.membershipId,
      score: candidate.score,
      eligible: candidate.eligible,
      source: "BASELINE" as const,
    }));
}

/** Stable hash of only the features sent to the model, for audit/replay. */
export function hashOptimizationInput(signals: OptimizationSignals): string {
  const features = signals.candidates.map((candidate) => ({
    membershipId: candidate.membershipId,
    distanceKm: candidate.distanceKm,
    rating: candidate.rating,
    completedTrips: candidate.completedTrips,
    inServiceArea: candidate.inServiceArea,
    hasVehicle: candidate.hasVehicle,
    activeJobs: candidate.activeJobs,
    capacity: candidate.capacity,
  }));
  return createHash("sha256")
    .update(JSON.stringify({ requestId: signals.requestId, features }))
    .digest("hex");
}
