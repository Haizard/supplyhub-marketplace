import "server-only";

import { z } from "zod";

import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";

import type { BusinessSignals, GeneratedInsight } from "./types";

const MAX_INSIGHTS = 6;
const TIMEOUT_MS = 8_000;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const geminiInsightSchema = z.object({
  type: z.enum([
    "LOW_STOCK",
    "REVENUE_TREND",
    "INVENTORY_IMBALANCE",
    "CUSTOMER_RETENTION",
    "RECOMMENDED_RESTOCK",
  ]),
  severity: z.enum(["INFO", "OPPORTUNITY", "WARNING"]),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(10).max(1000),
  recommendation: z.string().trim().min(10).max(1000),
  confidence: z.number().int().min(0).max(100),
  evidence: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
});

type FetchLike = typeof fetch;

/** True only when the operator explicitly opted in and supplied a key. */
export function isGeminiLiveEnabled(): boolean {
  const env = getServerEnv();
  return env.AI_INSIGHTS_PROVIDER === "gemini" && Boolean(env.GEMINI_API_KEY);
}

/** Parse and validate a model response into the existing insights contract. */
export function parseGeminiInsights(text: string): GeneratedInsight[] {
  const unwrap = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const json: unknown = JSON.parse(unwrap);
  const parsed = z.array(geminiInsightSchema).max(MAX_INSIGHTS).safeParse(json);
  if (!parsed.success) {
    throw new Error("Gemini response did not match the insights contract.");
  }
  return parsed.data;
}

function buildPrompt(signals: BusinessSignals): string {
  // Only aggregate signals cross the boundary — never personal data or credentials.
  const payload = {
    businessId: signals.businessId,
    lowStockProducts: signals.lowStockProducts.slice(0, 5),
    revenueLast30DaysCents: signals.revenueLast30DaysCents,
    revenuePrevious30DaysCents: signals.revenuePrevious30DaysCents,
    warehouseCount: signals.warehouseCount,
    productsWithoutStock: signals.productsWithoutStock,
    customerCount: signals.customerCount,
    repeatCustomerCount: signals.repeatCustomerCount,
  };
  return [
    "You generate concise retail operations insights for a marketplace seller.",
    `Return a JSON array of at most ${MAX_INSIGHTS} objects with exactly these fields:`,
    "type, severity, title, summary, recommendation, confidence, evidence.",
    "type must be one of LOW_STOCK, REVENUE_TREND, INVENTORY_IMBALANCE, CUSTOMER_RETENTION, RECOMMENDED_RESTOCK.",
    "severity must be one of INFO, OPPORTUNITY, WARNING. confidence is an integer 0-100.",
    "evidence is an object of short strings, numbers or string arrays. Do not invent numbers.",
    "Base every statement only on these aggregate signals:",
    JSON.stringify(payload),
  ].join("\n");
}

/** Build the provider request. Exported so tests can verify key handling. */
export function buildGeminiRequest(
  signals: BusinessSignals,
  apiKey: string,
  model: string,
): {
  url: string;
  init: RequestInit;
} {
  return {
    url: `${BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(signals) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    },
  };
}

/**
 * Live-model slice. Any failure returns null so the caller uses the deterministic
 * rules without exposing provider errors or keys to the user.
 */
export async function generateLiveInsights(
  signals: BusinessSignals,
  fetchImpl: FetchLike = fetch,
): Promise<GeneratedInsight[] | null> {
  if (!isGeminiLiveEnabled()) return null;

  const env = getServerEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { url, init } = buildGeminiRequest(signals, apiKey, env.GEMINI_MODEL);
    const response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn("insights.gemini_http_error", { status: response.status });
      return null;
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger.warn("insights.gemini_empty_response");
      return null;
    }

    return parseGeminiInsights(text);
  } catch (error) {
    logger.error("insights.gemini_failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}
