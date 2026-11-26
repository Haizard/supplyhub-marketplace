export function varianceKg(expectedKg: number, deliveredKg: number): number {
  return Math.round((deliveredKg - expectedKg) * 100) / 100;
}

export function variancePercent(expectedKg: number, deliveredKg: number): number {
  if (!(expectedKg > 0)) return 0;
  return Math.round((Math.abs(deliveredKg - expectedKg) / expectedKg) * 10_000) / 100;
}

/** Configurable default tolerance; outside it the delivery is recorded for review. */
export function isWithinTolerance(
  expectedKg: number,
  deliveredKg: number,
  tolerancePercent = 5,
): boolean {
  return variancePercent(expectedKg, deliveredKg) <= tolerancePercent;
}

export function agreementTotalMinor(quantity: number, pricePerUnit: number): number {
  return Math.round(quantity * pricePerUnit * 100);
}

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_FARMER", "CANCELLED"],
  PENDING_FARMER: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["DELIVERED", "CANCELLED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  DISPUTED: ["COMPLETED", "CANCELLED"],
};

export function canTransitionAgreement(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}
