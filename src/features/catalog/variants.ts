export interface VariantInput {
  id?: string;
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
}

export type VariantNormalizeResult =
  { ok: true; variants: VariantInput[]; totalStock: number } | { ok: false; error: string };

export const MAX_VARIANTS_PER_PRODUCT = 20;

/**
 * Validates the variant rows from the studio form before they reach the database:
 * unique names and SKUs, whole-cent prices, whole-unit stock, and a bounded count.
 * Returns the combined stock so the product's denormalized stock stays in step.
 */
export function normalizeVariants(variants: readonly VariantInput[]): VariantNormalizeResult {
  if (variants.length > MAX_VARIANTS_PER_PRODUCT) {
    return { ok: false, error: `Use ${MAX_VARIANTS_PER_PRODUCT} options or fewer.` };
  }

  const names = new Map<string, string>();
  const skus = new Set<string>();
  let totalStock = 0;

  for (const variant of variants) {
    const name = variant.name.trim();
    const sku = variant.sku.trim().toUpperCase();

    if (name.length < 1 || name.length > 60) {
      return { ok: false, error: "Give every option a name of 1–60 characters." };
    }

    if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(sku)) {
      return { ok: false, error: "Use uppercase letters, numbers, and hyphens for every SKU." };
    }

    if (!Number.isInteger(variant.priceCents) || variant.priceCents < 1) {
      return { ok: false, error: "Every option needs a price greater than zero." };
    }

    if (!Number.isInteger(variant.stock) || variant.stock < 0) {
      return { ok: false, error: "Option stock must be a whole number of units." };
    }

    const nameKey = name.toLowerCase();
    const existingName = names.get(nameKey);
    if (existingName) {
      return { ok: false, error: `Two options are both named “${existingName}”.` };
    }
    if (skus.has(sku)) {
      return { ok: false, error: `Two options share the SKU ${sku}.` };
    }

    names.set(nameKey, name);
    skus.add(sku);
    totalStock += variant.stock;

    if (totalStock > 100_000) {
      return { ok: false, error: "Combined option stock cannot exceed 100,000 units." };
    }
  }

  return {
    ok: true,
    variants: variants.map((variant) => ({
      ...variant,
      name: variant.name.trim(),
      sku: variant.sku.trim().toUpperCase(),
    })),
    totalStock,
  };
}
