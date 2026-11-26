import "server-only";

import { getDatabase } from "@/server/db/client";

import { productionCostPerKgMinor, harvestTotalKg } from "./farm-rules";

const toMinor = (value: { toString(): string }): number =>
  Math.round(Number(value.toString()) * 100);

export interface CropDetailView {
  id: string;
  cropName: string;
  variety: string | null;
  status: string;
  plantedAt: string | null;
  expectedHarvestAt: string | null;
  activities: { type: string; occurredAt: string; note: string | null }[];
  expenses: { category: string; amount: string; currency: string; occurredAt: string }[];
  harvests: { quantity: string; unit: string; harvestedAt: string; grade: string | null }[];
  totalCost: string;
  harvestedKg: number;
  costPerKg: string | null;
}

export async function getFarmManagementData(userId: string) {
  const database = getDatabase();
  const [farmer, crops] = await Promise.all([
    database.agricultureFarmer.findUnique({
      where: { userId },
      select: {
        id: true,
        farms: { select: { id: true, name: true, plots: { select: { id: true, name: true } } } },
      },
    }),
    database.farmCrop.findMany({
      where: { farmer: { userId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        cropName: true,
        variety: true,
        status: true,
        plantedAt: true,
        expectedHarvestAt: true,
        activities: {
          select: { type: true, occurredAt: true, note: true },
          orderBy: { occurredAt: "asc" },
        },
        expenses: {
          select: { amount: true, currency: true, category: true, occurredAt: true },
          orderBy: { occurredAt: "asc" },
        },
        harvests: {
          select: { quantity: true, unit: true, harvestedAt: true, grade: true },
          orderBy: { harvestedAt: "asc" },
        },
      },
    }),
  ]);

  const details: CropDetailView[] = crops.map((crop) => {
    const expensesMinor = crop.expenses.map((expense) => toMinor(expense.amount));
    const totalMinor = expensesMinor.reduce((sum, value) => sum + value, 0);
    const harvestedKg = harvestTotalKg(
      crop.harvests
        .filter((batch) => batch.unit === "KG")
        .map((batch) => ({ quantityKg: Number(batch.quantity.toString()) })),
    );
    const costMinor = productionCostPerKgMinor(expensesMinor, harvestedKg);
    return {
      id: crop.id,
      cropName: crop.cropName,
      variety: crop.variety,
      status: crop.status,
      plantedAt: crop.plantedAt?.toISOString() ?? null,
      expectedHarvestAt: crop.expectedHarvestAt?.toISOString() ?? null,
      activities: crop.activities.map((activity) => ({
        type: activity.type,
        occurredAt: activity.occurredAt.toISOString(),
        note: activity.note,
      })),
      expenses: crop.expenses.map((expense) => ({
        category: expense.category,
        amount: expense.amount.toString(),
        currency: expense.currency,
        occurredAt: expense.occurredAt.toISOString(),
      })),
      harvests: crop.harvests.map((batch) => ({
        quantity: batch.quantity.toString(),
        unit: batch.unit,
        harvestedAt: batch.harvestedAt.toISOString(),
        grade: batch.grade,
      })),
      totalCost: (totalMinor / 100).toFixed(2),
      harvestedKg,
      costPerKg: costMinor === null ? null : (costMinor / 100).toFixed(2),
    };
  });

  const season = {
    cropCount: details.length,
    harvestedCount: details.filter((crop) => crop.status === "HARVESTED").length,
    totalCost: (
      details.reduce((sum, crop) => sum + Math.round(Number(crop.totalCost) * 100), 0) / 100
    ).toFixed(2),
    harvestedKg: Math.round(details.reduce((sum, crop) => sum + crop.harvestedKg, 0) * 100) / 100,
  };

  return { farmer, crops: details, season };
}
