import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompanyDriverCandidate } from "@/features/logistics-company-dispatch/scoring";
import {
  applyAiRanking,
  buildOptimizationPrompt,
  buildOptimizationRequest,
  generateSuggestion,
} from "@/features/logistics-optimization/ai";
import { hashOptimizationInput, rankBaseline } from "@/features/logistics-optimization/baseline";
import type { OptimizationSignals } from "@/features/logistics-optimization/types";

const envState = {
  AI_INSIGHTS_PROVIDER: "rules",
  GEMINI_API_KEY: undefined as string | undefined,
  GEMINI_MODEL: "gemini-2.0-flash",
};

vi.mock("@/lib/config/env", () => ({
  getServerEnv: () => envState,
}));

function candidate(
  membershipId: string,
  overrides: Partial<CompanyDriverCandidate> = {},
): CompanyDriverCandidate {
  return {
    membershipId,
    distanceKm: 2,
    rating: 4.5,
    completedTrips: 20,
    inServiceArea: true,
    hasVehicle: true,
    activeJobs: 0,
    capacity: 3,
    ...overrides,
  };
}

const signals: OptimizationSignals = {
  companyId: "11111111-1111-4111-8111-111111111111",
  requestId: "22222222-2222-4222-8222-222222222222",
  candidates: [
    candidate("m-low", { rating: 3, completedTrips: 2 }),
    candidate("m-high", { rating: 5, completedTrips: 40 }),
    candidate("m-tie", { rating: 5, completedTrips: 40 }),
  ],
};

function aiResponse(ids: string[]): string {
  return JSON.stringify(
    ids.map((membershipId, index) => ({
      membershipId,
      rank: index + 1,
      rationale: "Aggregate features considered.",
    })),
  );
}

function geminiResponse(text: string): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Phase 9 L12 — deterministic baseline", () => {
  beforeEach(() => {
    envState.AI_INSIGHTS_PROVIDER = "rules";
    envState.GEMINI_API_KEY = undefined;
  });

  it("ranks by score and breaks ties deterministically by membership ID", () => {
    const baseline = rankBaseline(signals);
    expect(baseline[0]?.membershipId).toBe("m-high");
    expect(baseline[1]?.membershipId).toBe("m-tie");
    expect(baseline.every((entry) => entry.source === "BASELINE")).toBe(true);
    expect(rankBaseline(signals)).toEqual(baseline);
  });

  it("hashes only aggregate input features", () => {
    const hash = hashOptimizationInput(signals);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashOptimizationInput(signals));
    expect(hash).not.toBe(
      hashOptimizationInput({
        ...signals,
        candidates: [candidate("m-low", { rating: 2.9 })],
      }),
    );
  });

  it("never sends names, phones or addresses to the provider", () => {
    const prompt = buildOptimizationPrompt(signals);
    expect(prompt).toContain("m-high");
    expect(prompt).not.toMatch(/Amina|\+255|Main St/);
    const { url, init } = buildOptimizationRequest(signals, "secret-key", "gemini-2.0-flash");
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
  });
});

describe("Phase 9 L12 — AI ranking validation", () => {
  it("accepts a valid reordering while keeping baseline scores", () => {
    const baseline = rankBaseline(signals);
    const result = applyAiRanking(aiResponse(["m-low", "m-high", "m-tie"]), signals, baseline);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ranking.map((entry) => entry.membershipId)).toEqual(["m-low", "m-high", "m-tie"]);
    expect(result.ranking[0]?.score).toBe(baseline.find((e) => e.membershipId === "m-low")?.score);
    expect(result.ranking.every((entry) => entry.source === "AI")).toBe(true);
  });

  it("rejects unknown, duplicated, missing or badly ranked candidates", () => {
    const baseline = rankBaseline(signals);
    expect(applyAiRanking(aiResponse(["m-high", "m-tie", "intruder"]), signals, baseline).ok).toBe(
      false,
    );
    expect(applyAiRanking(aiResponse(["m-high", "m-high", "m-tie"]), signals, baseline).ok).toBe(
      false,
    );
    expect(applyAiRanking(aiResponse(["m-high", "m-tie"]), signals, baseline).ok).toBe(false);
    expect(applyAiRanking("not json", signals, baseline).ok).toBe(false);
  });

  it("rejects an ineligible candidate placed above an eligible one", () => {
    const withIneligible: OptimizationSignals = {
      ...signals,
      candidates: [candidate("m-eligible"), candidate("m-no-vehicle", { hasVehicle: false })],
    };
    const baseline = rankBaseline(withIneligible);
    const result = applyAiRanking(
      aiResponse(["m-no-vehicle", "m-eligible"]),
      withIneligible,
      baseline,
    );
    expect(result.ok).toBe(false);
  });

  it("falls back to the baseline and never calls the provider when AI is not enabled", async () => {
    const fetchMock = vi.fn();
    const result = await generateSuggestion(signals, fetchMock as unknown as typeof fetch);
    expect(result.source).toBe("BASELINE");
    expect(result.ranking).toEqual(rankBaseline(signals));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a validated AI ranking when the opt-in provider responds", async () => {
    envState.AI_INSIGHTS_PROVIDER = "gemini";
    envState.GEMINI_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(geminiResponse(aiResponse(["m-low", "m-high", "m-tie"])));
    const result = await generateSuggestion(signals, fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("AI");
    expect(result.ranking[0]?.membershipId).toBe("m-low");
  });

  it("falls back when the provider output violates the contract or throws", async () => {
    envState.AI_INSIGHTS_PROVIDER = "gemini";
    envState.GEMINI_API_KEY = "test-key";
    const invalidFetch = vi
      .fn()
      .mockResolvedValue(geminiResponse(aiResponse(["m-high", "ghost", "m-tie"])));
    const invalid = await generateSuggestion(signals, invalidFetch as unknown as typeof fetch);
    expect(invalid.source).toBe("BASELINE");
    expect(invalid.note).toContain("unknown candidate");

    const failingFetch = vi.fn().mockRejectedValue(new Error("offline"));
    const failed = await generateSuggestion(signals, failingFetch as unknown as typeof fetch);
    expect(failed.source).toBe("BASELINE");
    expect(failed.ranking).toEqual(rankBaseline(signals));
  });
});
