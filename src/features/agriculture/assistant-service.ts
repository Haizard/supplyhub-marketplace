import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { isGeminiLiveEnabled } from "@/features/insights/gemini";
import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import type { PrismaClient } from "@/generated/prisma/client";

import {
  buildBaselineAdvice,
  evidenceIds,
  sanitizeQuestion,
  type AdvicePayload,
  type AgricultureSignals,
} from "./assistant";
import { productionCostPerKgMinor } from "./farm-rules";

const TIMEOUT_MS = 8_000;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const adviceSchema = z.object({
  summary: z.string().trim().min(10).max(1000),
  recommendations: z
    .array(
      z.object({
        topic: z.string().trim().min(2).max(60),
        advice: z.string().trim().min(10).max(1000),
        confidence: z.number().int().min(0).max(100),
        evidence: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
      }),
    )
    .max(6),
  caveats: z.array(z.string().trim().min(5).max(500)).max(5),
});

type FetchLike = typeof fetch;

export interface AdviceResult {
  source: "BASELINE" | "AI";
  advice: AdvicePayload;
  note: string;
}

const toMinor = (value: { toString(): string }): number =>
  Math.round(Number(value.toString()) * 100);

/** Builds only aggregate signals; no names, phones, email, village or coordinates. */
export async function buildAgricultureSignals(
  database: PrismaClient,
  input: {
    farmerUserId: string;
    requestId: string;
    question: string;
    language: "en" | "sw";
  },
): Promise<AgricultureSignals> {
  const [farmer, offers, inputs] = await Promise.all([
    database.agricultureFarmer.findUnique({
      where: { userId: input.farmerUserId },
      select: {
        region: true,
        farms: { select: { sizeValue: true, sizeUnit: true } },
        crops: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            cropName: true,
            status: true,
            expectedHarvestAt: true,
            expenses: { select: { amount: true } },
            harvests: { select: { quantity: true, unit: true } },
          },
        },
      },
    }),
    database.agriculturalOffer.findMany({
      where: { farmer: { userId: input.farmerUserId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        pricePerUnit: true,
        currency: true,
        unit: true,
        listing: { select: { cropName: true } },
      },
    }),
    database.agriculturalInput.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, category: true, pricePerUnit: true, unit: true },
    }),
  ]);

  const areaAcres = (farmer?.farms ?? []).reduce((sum, farm) => {
    const size = Number(farm.sizeValue.toString());
    return sum + (farm.sizeUnit === "HECTARE" ? size * 2.47105 : size);
  }, 0);

  const crops = (farmer?.crops ?? []).map((crop, index) => {
    const expensesMinor = crop.expenses.map(toMinor);
    const harvestedKg = crop.harvests
      .filter((batch) => batch.unit === "KG")
      .reduce((sum, batch) => sum + Number(batch.quantity.toString()), 0);
    return {
      evidenceId: `crop:${index + 1}`,
      cropName: crop.cropName,
      status: crop.status,
      costPerKgMinor: productionCostPerKgMinor(expensesMinor, harvestedKg),
      harvestedKg: Math.round(harvestedKg * 100) / 100,
      expectedHarvestAt: crop.expectedHarvestAt?.toISOString() ?? null,
    };
  });

  return {
    requestId: input.requestId,
    language: input.language,
    question: sanitizeQuestion(input.question),
    region: farmer?.region ?? null,
    areaAcres: Math.round(areaAcres * 100) / 100,
    crops,
    offers: offers.map((offer, index) => ({
      evidenceId: `offer:${index + 1}`,
      cropName: offer.listing.cropName,
      pricePerUnitMinor: toMinor(offer.pricePerUnit),
      unit: offer.unit,
    })),
    inputs: inputs.map((inputRow, index) => ({
      evidenceId: `input:${index + 1}`,
      name: inputRow.name,
      category: inputRow.category,
      pricePerUnitMinor: toMinor(inputRow.pricePerUnit),
      unit: inputRow.unit,
    })),
  };
}

export function signalsHash(signals: AgricultureSignals): string {
  return createHash("sha256").update(JSON.stringify(signals)).digest("hex");
}

export function buildAssistantPrompt(signals: AgricultureSignals): string {
  const allowed = evidenceIds(signals);
  const payload = {
    requestId: signals.requestId,
    language: signals.language,
    question: signals.question,
    region: signals.region,
    areaAcres: signals.areaAcres,
    crops: signals.crops,
    offers: signals.offers,
    inputs: signals.inputs,
  };
  return [
    "You are an advisory assistant for a smallholder farmer. Use only the supplied aggregate records.",
    "Return JSON with exactly: summary, recommendations[].{topic,advice,confidence,evidence}, caveats[].",
    `Every recommendation evidence entry must be one of: ${allowed.join(", ") || "none"}.`,
    "Never invent numbers or agronomic facts. Express uncertainty and defer to qualified specialists for disease, pesticide or fertilizer advice.",
    "Do not include names, phone numbers, emails, village names or coordinates.",
    `Answer in ${signals.language === "sw" ? "Kiswahili" : "English"}.`,
    JSON.stringify(payload),
  ].join("\n");
}

export function buildAssistantRequest(
  signals: AgricultureSignals,
  apiKey: string,
  model: string,
): { url: string; init: RequestInit } {
  return {
    url: `${BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildAssistantPrompt(signals) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    },
  };
}

export function parseAiAdvice(text: string, signals: AgricultureSignals): AdvicePayload {
  const unwrap = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed = adviceSchema.safeParse(JSON.parse(unwrap));
  if (!parsed.success) throw new Error("Model response did not match the advice contract.");

  const allowed = new Set(evidenceIds(signals));
  for (const recommendation of parsed.data.recommendations) {
    if (recommendation.evidence.some((id) => !allowed.has(id))) {
      throw new Error("Model referenced evidence that was not supplied.");
    }
  }
  return parsed.data;
}

/** Any provider failure, invalid output or disabled opt-in returns the baseline. */
export async function generateAgricultureAdvice(
  signals: AgricultureSignals,
  fetchImpl: FetchLike = fetch,
): Promise<AdviceResult> {
  const baseline = buildBaselineAdvice(signals);
  const fallback = (note: string): AdviceResult => ({ source: "BASELINE", advice: baseline, note });
  if (!isGeminiLiveEnabled()) {
    return fallback("AI assistance is not enabled; deterministic record-based guidance used.");
  }

  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) {
    return fallback("AI assistance has no key; deterministic record-based guidance used.");
  }

  try {
    const { url, init } = buildAssistantRequest(signals, env.GEMINI_API_KEY, env.GEMINI_MODEL);
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      logger.warn("agriculture.assistant_http_error", { status: response.status });
      return fallback("AI provider did not respond; deterministic record-based guidance used.");
    }
    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallback("AI provider returned no advice; deterministic guidance used.");
    const advice = parseAiAdvice(text, signals);
    return {
      source: "AI",
      advice,
      note: "Advisory AI response validated against the farmer's own records.",
    };
  } catch (error) {
    logger.warn("agriculture.assistant_failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return fallback("AI advice could not be validated; deterministic record-based guidance used.");
  }
}
