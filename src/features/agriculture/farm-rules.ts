/** Costs stay in integer minor units; harvest quantity is in kilograms. */
export function productionCostPerKgMinor(
  expensesMinor: number[],
  harvestKg: number,
): number | null {
  if (!(harvestKg > 0)) return null;
  const total = expensesMinor.reduce((sum, value) => sum + value, 0);
  return Math.round(total / harvestKg);
}

export function canRecordHarvest(cropStatus: string): boolean {
  return ["PLANTED", "GROWING", "HARVESTED"].includes(cropStatus);
}

export function harvestTotalKg(batches: { quantityKg: number }[]): number {
  return Math.round(batches.reduce((sum, batch) => sum + batch.quantityKg, 0) * 100) / 100;
}
