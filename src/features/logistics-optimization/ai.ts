import "server-only";

import { z } from "zod";

import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { isGeminiLiveEnabled } from "@/features/insights/gemini";

import { rankBaseline } from "./baseline";
import type { OptimizationSignals, RankedCandidate, SuggestionResult } from "./types";

const TIMEOUT_MS = 8_000;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_CANDIDATES = 50;

const rankingEntrySchema = z.object({
  membershipId: z.string().trim().min(1).max(80),
  rank: z.number().int().min(1).max(MAX_CANDIDATES),
  rationale: z.string().trim().min(1).max(200),
});

type FetchLike = typeof fetch;

/** Only opaque IDs and aggregate features cross the provider boundary. */
export function buildOptimizationPrompt(signals: OptimizationSignals): string {
  const payload = {
    requestId: signals.requestId,
    candidates: signals.candidates.map((candidate) => ({
      membershipId: candidate.membershipId,
      distanceKm: candidate.distanceKm,
      rating: candidate.rating,
      completedTrips: candidate.completedTrips,
      inServiceArea: candidate.inServiceArea,
      hasVehicle: candidate.hasVehicle,
      activeJobs: candidate.activeJobs,
      capacity: candidate.capacity,
    })),
  };
  return [
    "You advise a logistics dispatcher on driver ordering. You must not invent or omit candidates.",
    `Return a JSON array of exactly ${signals.candidates.length} objects with fields: membershipId, rank, rationale.`,
    "membershipId must be copied verbatim from the supplied candidate IDs. rank is an integer starting at 1.",
    "rationale is at most 200 characters. Do not include names, phone numbers, addresses or prices.",
    "Never rank an ineligible candidate (no vehicle, outside the service area, or at capacity) above an eligible one.",
    JSON.stringify(payload),
  ].join("\n");
}

export function buildOptimizationRequest(
  signals: OptimizationSignals,
  apiKey: string,
  model: string,
): { url: string; init: RequestInit } {
  return {
    url: `${BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildOptimizationPrompt(signals) }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    },
  };
}

export type RankingValidation =
  { ok: true; ranking: RankedCandidate[] } | { ok: false; reason: string };

/**
 * Validates a model ranking against the candidate set and the eligibility invariant.
 * Any violation discards the AI output and keeps the deterministic baseline.
 */
export function applyAiRanking(
  text: string,
  signals: OptimizationSignals,
  baseline: RankedCandidate[],
): RankingValidation {
  const unwrap = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(unwrap);
  } catch {
    return { ok: false, reason: "Model output was not valid JSON." };
  }

  const parsed = z.array(rankingEntrySchema).max(MAX_CANDIDATES).safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: "Model output did not match the ranking contract." };
  }

  const expected = new Set(signals.candidates.map((candidate) => candidate.membershipId));
  const received = parsed.data.map((entry) => entry.membershipId);
  if (received.length !== expected.size || new Set(received).size !== received.length) {
    return { ok: false, reason: "Model ranking duplicated or omitted candidates." };
  }
  if (received.some((id) => !expected.has(id))) {
    return { ok: false, reason: "Model ranking included an unknown candidate." };
  }
  const ranks = parsed.data.map((entry) => entry.rank).sort((a, b) => a - b);
  if (ranks.some((rank, index) => rank !== index + 1)) {
    return { ok: false, reason: "Model ranking had missing or repeated ranks." };
  }

  const ordered = [...parsed.data].sort((a, b) => a.rank - b.rank);
  const byId = new Map(baseline.map((candidate) => [candidate.membershipId, candidate]));
  const ranking = ordered.map((entry) => {
    const baselineEntry = byId.get(entry.membershipId);
    if (!baselineEntry) {
      throw new Error("Baseline candidate missing during AI ranking merge.");
    }
    return {
      ...baselineEntry,
      source: "AI" as const,
      rationale: entry.rationale,
    };
  });

  const lastEligible = ranking.reduce(
    (last, candidate, index) => (candidate.eligible ? index : last),
    -1,
  );
  const firstIneligible = ranking.findIndex((candidate) => !candidate.eligible);
  if (firstIneligible !== -1 && firstIneligible < lastEligible) {
    return {
      ok: false,
      reason: "Model ranking placed an ineligible driver above an eligible one.",
    };
  }

  return { ok: true, ranking };
}

async function requestRanking(
  signals: OptimizationSignals,
  fetchImpl: FetchLike,
): Promise<string | null> {
  if (!isGeminiLiveEnabled()) return null;
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) return null;
  const { url, init } = buildOptimizationRequest(signals, env.GEMINI_API_KEY, env.GEMINI_MODEL);
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    logger.warn("logistics.optimization_gemini_http_error", { status: response.status });
    return null;
  }
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    logger.warn("logistics.optimization_gemini_empty_response");
    return null;
  }
  return text;
}

function fallback(baseline: RankedCandidate[], note: string): SuggestionResult {
  return {
    source: "BASELINE",
    ranking: baseline,
    baselineRanking: baseline,
    model: null,
    note,
  };
}

/**
 * Always returns a usable ranking. Any provider failure, invalid output or policy
 * violation falls back to the deterministic baseline without changing job state.
 */
export async function generateSuggestion(
  signals: OptimizationSignals,
  fetchImpl: FetchLike = fetch,
): Promise<SuggestionResult> {
  const baseline = rankBaseline(signals);

  if (!isGeminiLiveEnabled()) {
    return fallback(baseline, "AI optimisation is not enabled; deterministic baseline used.");
  }

  try {
    const text = await requestRanking(signals, fetchImpl);
    if (!text) {
      return fallback(
        baseline,
        "The AI provider returned no ranking; deterministic baseline used.",
      );
    }
    const validated = applyAiRanking(text, signals, baseline);
    if (!validated.ok) {
      logger.warn("logistics.optimization_ai_rejected", { reason: validated.reason });
      return fallback(baseline, `${validated.reason} Deterministic baseline used.`);
    }
    return {
      source: "AI",
      ranking: validated.ranking,
      baselineRanking: baseline,
      model: getServerEnv().GEMINI_MODEL,
      note: "Advisory AI ordering validated against the deterministic baseline.",
    };
  } catch (error) {
    logger.error("logistics.optimization_ai_failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return fallback(baseline, "AI optimisation failed; deterministic baseline used.");
  }
}
