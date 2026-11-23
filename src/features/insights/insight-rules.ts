import type { BusinessSignals, GeneratedInsight } from "./types";

const LOW_STOCK_THRESHOLD = 5;
const SIGNIFICANT_CHANGE_BPS = 1_000;
const LOW_REPEAT_RATE_BPS = 2_000;

const clampBps = (value: number) => Math.max(-10_000, Math.min(10_000, value));

function percentFromBps(bps: number): string {
  return `${Math.abs(bps / 100).toFixed(1)}%`;
}

/**
 * Rule version `configurable-rules-v1`. This is deliberately deterministic:
 * no external model, no network call, and no invented business policy.
 */
export function buildBusinessInsights(signals: BusinessSignals): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  const changeBps =
    signals.revenuePrevious30DaysCents === 0
      ? signals.revenueLast30DaysCents > 0
        ? 10_000
        : 0
      : clampBps(
          Math.round(
            ((signals.revenueLast30DaysCents - signals.revenuePrevious30DaysCents) * 10_000) /
              signals.revenuePrevious30DaysCents,
          ),
        );

  if (signals.lowStockProducts.length > 0) {
    const names = signals.lowStockProducts.slice(0, 3).map((product) => product.name);

    insights.push({
      type: "LOW_STOCK",
      severity: "WARNING",
      title: "Low-stock products need attention",
      summary: `${signals.lowStockProducts.length} published product(s) are at or below ${LOW_STOCK_THRESHOLD} units: ${names.join(", ")}.`,
      recommendation:
        "Review these items before the next promotion and adjust stock from the inventory panel.",
      confidence: 95,
      evidence: {
        productCount: signals.lowStockProducts.length,
        productNames: names,
        threshold: LOW_STOCK_THRESHOLD,
      },
    });
  }

  if (Math.abs(changeBps) >= SIGNIFICANT_CHANGE_BPS) {
    const growing = changeBps > 0;

    insights.push({
      type: "REVENUE_TREND",
      severity: growing ? "OPPORTUNITY" : "WARNING",
      title: growing ? "Revenue is trending up" : "Revenue has softened",
      summary: `Recorded revenue changed ${percentFromBps(changeBps)} versus the previous 30-day window.`,
      recommendation: growing
        ? "Keep the best-selling categories in stock and consider featuring them in the storefront."
        : "Check the low-stock and customer-retention signals before changing prices or running promotions.",
      confidence: 85,
      evidence: {
        changeBps,
        currentCents: signals.revenueLast30DaysCents,
        previousCents: signals.revenuePrevious30DaysCents,
      },
    });
  }

  if (signals.warehouseCount > 1 && signals.productsWithoutStock > 0) {
    insights.push({
      type: "INVENTORY_IMBALANCE",
      severity: "OPPORTUNITY",
      title: "Stock can be rebalanced",
      summary: `${signals.productsWithoutStock} product(s) have no balance in any active warehouse across ${signals.warehouseCount} warehouses.`,
      recommendation:
        "Compare warehouse balances with the product stock column and move inventory where demand is strongest.",
      confidence: 80,
      evidence: {
        warehouseCount: signals.warehouseCount,
        productsWithoutStock: signals.productsWithoutStock,
      },
    });
  }

  const repeatRateBps =
    signals.customerCount === 0
      ? 0
      : Math.round((signals.repeatCustomerCount * 10_000) / signals.customerCount);

  if (signals.customerCount >= 3 && repeatRateBps < LOW_REPEAT_RATE_BPS) {
    insights.push({
      type: "CUSTOMER_RETENTION",
      severity: "OPPORTUNITY",
      title: "Repeat purchases are limited",
      summary: `${signals.repeatCustomerCount} of ${signals.customerCount} recorded customers have ordered more than once.`,
      recommendation:
        "Use the studio CRM segments to follow up with recent buyers and the loyalty programme for repeat visits.",
      confidence: 75,
      evidence: {
        customerCount: signals.customerCount,
        repeatCustomerCount: signals.repeatCustomerCount,
        repeatRateBps,
      },
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "RECOMMENDED_RESTOCK",
      severity: "INFO",
      title: "Workspace signals are stable",
      summary:
        "No stock, revenue, inventory, or retention threshold was crossed in the latest window.",
      recommendation:
        "Keep catalog details and warehouse balances current so future signals stay reliable.",
      confidence: 70,
      evidence: { rule: "no-thresholds-crossed" },
    });
  }

  return insights;
}
