/**
 * Pure point-of-sale arithmetic. All money is integer cents until it is stored;
 * nothing here uses floating point.
 */

export interface SaleLine {
  unitPriceCents: number;
  quantity: number;
}

export function lineTotalCents(unitPriceCents: number, quantity: number): number | null {
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;

  const total = unitPriceCents * quantity;

  return Number.isSafeInteger(total) ? total : null;
}

export function saleSubtotalCents(lines: readonly SaleLine[]): number | null {
  let subtotal = 0;

  for (const line of lines) {
    const total = lineTotalCents(line.unitPriceCents, line.quantity);
    if (total === null) return null;
    subtotal += total;
  }

  return Number.isSafeInteger(subtotal) ? subtotal : null;
}

/** Change owed for a cash tender, or null when the tender does not cover the total. */
export function cashChangeCents(totalCents: number, tenderedCents: number): number | null {
  if (!Number.isInteger(totalCents) || totalCents < 0) return null;
  if (!Number.isInteger(tenderedCents) || tenderedCents < totalCents) return null;

  return tenderedCents - totalCents;
}

/** Midnight at the start of the given day, used for "today" reports. */
export function startOfDay(reference: Date): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  return start;
}
