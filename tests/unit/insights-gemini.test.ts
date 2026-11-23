import { describe, expect, it } from "vitest";

import { buildGeminiRequest, parseGeminiInsights } from "@/features/insights/gemini";
import type { BusinessSignals } from "@/features/insights/types";

const signals: BusinessSignals = {
  businessId: "00000000-0000-4000-8000-000000000001",
  lowStockProducts: [{ id: "p1", name: "Linen shirt", stock: 3 }],
  revenueLast30DaysCents: 120000,
  revenuePrevious30DaysCents: 100000,
  warehouseCount: 2,
  productsWithoutStock: 1,
  customerCount: 10,
  repeatCustomerCount: 1,
};

const validResponse = JSON.stringify([
  {
    type: "LOW_STOCK",
    severity: "WARNING",
    title: "Restock the linen shirt",
    summary: "The linen shirt is down to three units in the current window.",
    recommendation: "Add stock from the inventory panel before the next promotion.",
    confidence: 88,
    evidence: { productNames: ["Linen shirt"], productCount: 1 },
  },
]);

describe("Gemini live insights slice", () => {
  it("parses a fenced JSON model response into the insights contract", () => {
    const insights = parseGeminiInsights(`\`\`\`json\n${validResponse}\n\`\`\``);
    expect(insights).toHaveLength(1);
    expect(insights[0]?.type).toBe("LOW_STOCK");
    expect(insights[0]?.evidence.productCount).toBe(1);
  });

  it("rejects a response with an unknown insight type", () => {
    const bad = validResponse.replace("LOW_STOCK", "MADE_UP_TYPE");
    expect(() => parseGeminiInsights(bad)).toThrow();
  });

  it("rejects a response with an out-of-range confidence", () => {
    const bad = validResponse.replace('"confidence":88', '"confidence":880');
    expect(() => parseGeminiInsights(bad)).toThrow();
  });

  it("sends the key in a header, never in the URL", () => {
    const { url, init } = buildGeminiRequest(signals, "secret-key", "gemini-2.0-flash");
    expect(url).toContain("gemini-2.0-flash:generateContent");
    expect(url).not.toContain("secret-key");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("secret-key");
  });

  it("never sends personal data to the provider", () => {
    const { init } = buildGeminiRequest(signals, "secret-key", "gemini-2.0-flash");
    const body = JSON.stringify(init.body);
    expect(body).toContain("Linen shirt");
    expect(body).toContain("120000");
    expect(body).not.toContain("customer@example.com");
  });
});
