export function isEligibleLogisticsCompany(status: string): boolean {
  return status === "APPROVED";
}

/** Configurable default: base fee plus per-kilometre charge, in integer minor units. */
export function deliveryFeeMinor(
  distanceKm: number,
  baseMinor = 500_000,
  perKmMinor = 20_000,
): number {
  return Math.round(baseMinor + Math.max(0, distanceKm) * perKmMinor);
}

export function acceptedWeightKg(weighedKg: number, rejectedKg: number): number {
  return Math.round(Math.max(0, weighedKg - Math.max(0, rejectedKg)) * 100) / 100;
}

export function storageCapacityAvailable(
  capacityKg: number,
  heldKg: number,
  requestedKg: number,
): boolean {
  return requestedKg > 0 && heldKg + requestedKg <= capacityKg;
}

const STORAGE_TRANSITIONS: Record<string, string[]> = {
  HELD: ["STORED", "RELEASED"],
  STORED: ["RELEASED"],
};

export function canTransitionStorage(from: string, to: string): boolean {
  return (STORAGE_TRANSITIONS[from] ?? []).includes(to);
}
