"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";

import { ensureAgricultureEnabled, requireFarmerProfile } from "./access";
import { canRecordHarvest } from "./farm-rules";
import {
  activitySchema,
  cropSchema,
  cropStatusSchema,
  expenseSchema,
  harvestSchema,
} from "./farm-validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}
const decimal = (value: number) => new Prisma.Decimal(value);
const PATH = "/agriculture/farm-management";

async function enabled(): Promise<FormState | null> {
  try {
    await ensureAgricultureEnabled();
    return null;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Agriculture network unavailable.");
  }
}

export async function createCropAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = cropSchema.safeParse({
    farmId: formValue(formData, "farmId"),
    plotId: formValue(formData, "plotId"),
    cropName: formValue(formData, "cropName"),
    variety: formValue(formData, "variety"),
    seedQuantity: formValue(formData, "seedQuantity"),
    seedUnit: formValue(formData, "seedUnit") || undefined,
    plantedAt: formValue(formData, "plantedAt"),
    expectedHarvestAt: formValue(formData, "expectedHarvestAt"),
    expectedProduction: formValue(formData, "expectedProduction"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const database = getDatabase();

  const farm = await database.farm.findFirst({
    where: { id: parsed.data.farmId, farmerId: farmer.id },
    select: { id: true },
  });
  if (!farm) return fail("Farm not found.");
  if (parsed.data.plotId) {
    const plot = await database.farmPlot.findFirst({
      where: { id: parsed.data.plotId, farmId: farm.id },
      select: { id: true },
    });
    if (!plot) return fail("Plot not found on this farm.");
  }

  await database.$transaction(async (tx) => {
    const crop = await tx.farmCrop.create({
      data: {
        farmerId: farmer.id,
        farmId: farm.id,
        plotId: parsed.data.plotId ?? null,
        cropName: parsed.data.cropName,
        variety: parsed.data.variety ?? null,
        seedQuantity:
          parsed.data.seedQuantity === undefined ? null : decimal(parsed.data.seedQuantity),
        seedUnit: parsed.data.seedUnit ?? null,
        plantedAt: parsed.data.plantedAt ?? null,
        expectedHarvestAt: parsed.data.expectedHarvestAt ?? null,
        expectedProduction:
          parsed.data.expectedProduction === undefined
            ? null
            : decimal(parsed.data.expectedProduction),
        status: parsed.data.plantedAt ? "PLANTED" : "PLANNED",
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: farmer.userId,
      action: "AGRICULTURE_CROP_CREATED",
      targetType: "FarmCrop",
      targetId: crop.id,
      metadata: { cropName: parsed.data.cropName, farmId: farm.id },
    });
  });
  revalidatePath(PATH);
  return ok("Crop cycle created.");
}

export async function addCropActivityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = activitySchema.safeParse({
    cropId: formValue(formData, "cropId"),
    type: formValue(formData, "type"),
    occurredAt: formValue(formData, "occurredAt"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const crop = await getDatabase().farmCrop.findFirst({
    where: { id: parsed.data.cropId, farmerId: farmer.id, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (!crop) return fail("Crop not found.");
  await getDatabase().cropActivity.create({
    data: {
      cropId: crop.id,
      type: parsed.data.type,
      occurredAt: parsed.data.occurredAt,
      note: parsed.data.note ?? null,
    },
  });
  revalidatePath(PATH);
  return ok("Activity recorded.");
}

export async function recordFarmExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = expenseSchema.safeParse({
    cropId: formValue(formData, "cropId"),
    category: formValue(formData, "category"),
    amount: formValue(formData, "amount"),
    currency: formValue(formData, "currency"),
    occurredAt: formValue(formData, "occurredAt"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const database = getDatabase();
  if (parsed.data.cropId) {
    const crop = await database.farmCrop.findFirst({
      where: { id: parsed.data.cropId, farmerId: farmer.id },
      select: { id: true },
    });
    if (!crop) return fail("Crop not found.");
  }

  await database.$transaction(async (tx) => {
    const expense = await tx.farmExpense.create({
      data: {
        farmerId: farmer.id,
        cropId: parsed.data.cropId ?? null,
        category: parsed.data.category,
        amount: decimal(parsed.data.amount),
        currency: parsed.data.currency,
        occurredAt: parsed.data.occurredAt,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: farmer.userId,
      action: "AGRICULTURE_EXPENSE_RECORDED",
      targetType: "FarmExpense",
      targetId: expense.id,
      metadata: { category: parsed.data.category, amount: parsed.data.amount },
    });
  });
  revalidatePath(PATH);
  return ok("Expense recorded and included in production cost.");
}

export async function recordHarvestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = harvestSchema.safeParse({
    cropId: formValue(formData, "cropId"),
    harvestedAt: formValue(formData, "harvestedAt"),
    quantity: formValue(formData, "quantity"),
    unit: formValue(formData, "unit"),
    grade: formValue(formData, "grade"),
    storageLocation: formValue(formData, "storageLocation"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const database = getDatabase();
  const crop = await database.farmCrop.findFirst({
    where: { id: parsed.data.cropId, farmerId: farmer.id },
    select: { id: true, status: true },
  });
  if (!crop || !canRecordHarvest(crop.status)) return fail("That crop cannot be harvested.");

  await database.$transaction(async (tx) => {
    const batch = await tx.harvestBatch.create({
      data: {
        cropId: crop.id,
        farmerId: farmer.id,
        harvestedAt: parsed.data.harvestedAt,
        quantity: decimal(parsed.data.quantity),
        unit: parsed.data.unit,
        grade: parsed.data.grade ?? null,
        storageLocation: parsed.data.storageLocation ?? null,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    await tx.farmCrop.update({ where: { id: crop.id }, data: { status: "HARVESTED" } });
    await recordAuditEvent(tx, {
      actorId: farmer.userId,
      action: "AGRICULTURE_HARVEST_RECORDED",
      targetType: "HarvestBatch",
      targetId: batch.id,
      metadata: { cropId: crop.id, quantity: parsed.data.quantity, unit: parsed.data.unit },
    });
  });
  revalidatePath(PATH);
  return ok("Harvest recorded. Production cost per kg is updated.");
}

export async function setCropStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = cropStatusSchema.safeParse({
    cropId: formValue(formData, "cropId"),
    status: formValue(formData, "status"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const result = await getDatabase().farmCrop.updateMany({
    where: {
      id: parsed.data.cropId,
      farmerId: farmer.id,
      status: { in: ["PLANNED", "PLANTED", "GROWING"] },
    },
    data: { status: parsed.data.status },
  });
  if (result.count === 0) return fail("Crop status cannot be changed.");
  revalidatePath(PATH);
  return ok("Crop status updated.");
}
