import { describe, expect, it } from "vitest";

import { normalizeVariants } from "@/features/catalog/variants";

describe("product variant rows", () => {
  it("normalizes names and SKUs and sums stock", () => {
    const result = normalizeVariants([
      { name: " Sand ", sku: "carafe-s", priceCents: 185000, stock: 4 },
      { name: "Ink", sku: "CARAFE-I", priceCents: 195000, stock: 6 },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalStock).toBe(10);
    expect(result.variants[0]).toMatchObject({ name: "Sand", sku: "CARAFE-S" });
  });

  it("rejects duplicate names and SKUs", () => {
    const duplicateName = normalizeVariants([
      { name: "Sand", sku: "A-1", priceCents: 100, stock: 1 },
      { name: "sand", sku: "A-2", priceCents: 100, stock: 1 },
    ]);
    expect(duplicateName).toEqual({
      ok: false,
      error: "Two options are both named “Sand”.",
    });

    const duplicateSku = normalizeVariants([
      { name: "One", sku: "A-1", priceCents: 100, stock: 1 },
      { name: "Two", sku: "a-1", priceCents: 100, stock: 1 },
    ]);
    expect(duplicateSku).toEqual({
      ok: false,
      error: "Two options share the SKU A-1.",
    });
  });

  it("rejects invalid price, stock, and SKU values", () => {
    expect(normalizeVariants([{ name: "One", sku: "A-1", priceCents: 0, stock: 1 }]).ok).toBe(
      false,
    );
    expect(normalizeVariants([{ name: "One", sku: "A-1", priceCents: 100, stock: -1 }]).ok).toBe(
      false,
    );
    expect(normalizeVariants([{ name: "One", sku: "1!", priceCents: 100, stock: 1 }]).ok).toBe(
      false,
    );
  });
});
