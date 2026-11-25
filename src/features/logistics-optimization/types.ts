import type { CompanyDriverCandidate } from "@/features/logistics-company-dispatch/scoring";

export type OptimizationSource = "BASELINE" | "AI";

export interface RankedCandidate {
  membershipId: string;
  score: number;
  eligible: boolean;
  source: OptimizationSource;
  rationale?: string;
}

export interface OptimizationSignals {
  companyId: string;
  requestId: string;
  candidates: CompanyDriverCandidate[];
}

export interface SuggestionResult {
  source: OptimizationSource;
  ranking: RankedCandidate[];
  baselineRanking: RankedCandidate[];
  model: string | null;
  note: string;
}
