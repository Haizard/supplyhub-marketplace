/** Minimal Decimal shape so pure pricing logic stays database-agnostic. */
export interface DecimalLike {
  toString(): string;
}

export interface Tier {
  minQty: number;
  maxQty: number | null;
  unitPrice: DecimalLike;
}

/**
 * Resolves the unit price for a quantity from a supplier's volume tiers.
 * Tiers are matched by [minQty, maxQty] inclusive; the base listing price is
 * used when no tier applies. Among overlapping tiers the highest minQty wins.
 */
export function resolveTierUnitPrice(
  quantity: number,
  basePrice: DecimalLike,
  tiers: readonly Tier[],
): string {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a positive integer.");
  }

  const matching = tiers
    .filter((tier) => quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty))
    .sort((a, b) => b.minQty - a.minQty);

  return (matching[0] ?? { unitPrice: basePrice }).unitPrice.toString();
}

/** Computes a monetary total from integer cents without float drift. */
export function totalFromCents(unitPriceCents: number, quantity: number): number {
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error("Unit price must be non-negative integer cents.");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a positive integer.");
  }
  return unitPriceCents * quantity;
}

export interface OrderTotalsInput {
  items: readonly { lineTotal: DecimalLike }[];
  taxCents?: number;
  shippingCents?: number;
}

/**
 * Aggregates line totals into subtotal/tax/shipping/total as decimal strings.
 * Decimal inputs are read from Prisma's Decimal via toString().
 */
export function calculateOrderTotals(input: OrderTotalsInput): {
  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  total: string;
} {
  const toCents = (value: DecimalLike): number => {
    const raw = value.toString();
    const [whole, fraction = "0"] = raw.split(".");
    const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
    if (!Number.isFinite(cents) || cents < 0) throw new Error("Invalid monetary value.");
    return cents;
  };

  const subtotalCents = input.items.reduce((sum, item) => sum + toCents(item.lineTotal), 0);
  const taxCents = input.taxCents ?? 0;
  const shippingCents = input.shippingCents ?? 0;
  const totalCents = subtotalCents + taxCents + shippingCents;

  const asDecimal = (cents: number) =>
    `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
  return {
    subtotal: asDecimal(subtotalCents),
    taxTotal: asDecimal(taxCents),
    shippingTotal: asDecimal(shippingCents),
    total: asDecimal(totalCents),
  };
}

/** Generates a human-readable document number, e.g. `WL-AB12CD34`. */
export function makeDocumentNumber(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
