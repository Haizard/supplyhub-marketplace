import { describe, expect, it, vi } from "vitest";

import {
  buildBaselineAdvice,
  sanitizeQuestion,
  type AgricultureSignals,
} from "@/features/agriculture/assistant";
import {
  buildAssistantPrompt,
  generateAgricultureAdvice,
  parseAiAdvice,
} from "@/features/agriculture/assistant-service";

const envState = {
  AI_INSIGHTS_PROVIDER: "rules",
  GEMINI_API_KEY: undefined as string | undefined,
  GEMINI_MODEL: "gemini-2.0-flash",
};

vi.mock("@/lib/config/env", () => ({ getServerEnv: () => envState }));

const signals: AgricultureSignals = {
  requestId: "AA-1",
  language: "en",
  question: "How should I price my maize?",
  region: "Arusha",
  areaAcres: 2,
  crops: [
    {
      evidenceId: "crop:1",
      cropName: "Maize",
      status: "GROWING",
      costPerKgMinor: 55_000,
      harvestedKg: 1000,
      expectedHarvestAt: "2027-03-01T00:00:00.000Z",
    },
  ],
  offers: [
    {
      evidenceId: "offer:1",
      cropName: "Maize",
      pricePerUnitMinor: 120_000,
      unit: "KG",
    },
  ],
  inputs: [
    {
      evidenceId: "input:1",
      name: "Compost",
      category: "MANURE_COMPOST",
      pricePerUnitMinor: 5_000,
      unit: "BAG",
    },
  ],
};

const validAdvice = JSON.stringify({
  summary: "Your recorded maize cost is 550 shillings per kg.",
  recommendations: [
    {
      topic: "pricing",
      advice: "Compare your recorded cost with the recorded maize offer before agreeing a price.",
      confidence: 80,
      evidence: ["crop:1", "offer:1"],
    },
  ],
  caveats: ["Advisory only; consult an agronomist for agronomic decisions."],
});

describe("Phase 11 F — advisory agriculture assistant", () => {
  it("builds deterministic guidance from records with a caveat", () => {
    const baseline = buildBaselineAdvice(signals);
    expect(baseline.summary).toContain("550.00");
    expect(baseline.recommendations.map((item) => item.topic)).toContain("cost");
    expect(baseline.caveats[0]).toMatch(/not a substitute/i);
  });

  it("strips direct identifiers from questions", () => {
    const cleaned = sanitizeQuestion(
      "Call +255712345678 or email farmer@example.com, see https://x.co/a",
    );
    expect(cleaned).not.toContain("+255712345678");
    expect(cleaned).not.toContain("farmer@example.com");
    expect(cleaned).not.toContain("https://x.co/a");
    expect(cleaned).toContain("[number]");
  });

  it("never sends personal data or undeclared evidence in the prompt", () => {
    const prompt = buildAssistantPrompt(signals);
    expect(prompt).not.toContain("farmer@example.com");
    expect(prompt).not.toContain("+255712345678");
    expect(prompt).not.toContain('"village"');
    expect(prompt).not.toContain('"latitude"');
    expect(prompt).toContain("crop:1");
    expect(prompt).toContain("Maize");
    expect(prompt).not.toContain("AA-secret-key");
  });

  it("validates model output against the supplied evidence set", () => {
    expect(parseAiAdvice(validAdvice, signals).recommendations[0]?.topic).toBe("pricing");
    expect(() => parseAiAdvice(validAdvice.replace("offer:1", "invented:9"), signals)).toThrow();
  });

  it("falls back to baseline when opt-in is off or output is invalid", async () => {
    envState.AI_INSIGHTS_PROVIDER = "rules";
    const disabled = await generateAgricultureAdvice(signals, vi.fn() as never);
    expect(disabled.source).toBe("BASELINE");

    envState.AI_INSIGHTS_PROVIDER = "gemini";
    envState.GEMINI_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: validAdvice }] } }] }),
          { status: 200 },
        ),
      );
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const success = await generateAgricultureAdvice(signals);
      expect(success.source).toBe("AI");
      expect(success.advice.recommendations[0]?.evidence).toEqual(["crop:1", "offer:1"]);

      const badFetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
      globalThis.fetch = badFetch as unknown as typeof fetch;
      const failed = await generateAgricultureAdvice(signals);
      expect(failed.source).toBe("BASELINE");
    } finally {
      globalThis.fetch = original;
      envState.AI_INSIGHTS_PROVIDER = "rules";
      envState.GEMINI_API_KEY = undefined;
    }
  });
});
