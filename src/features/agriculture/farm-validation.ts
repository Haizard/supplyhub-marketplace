import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
const money = z.coerce.number().positive().max(99_999_999);
const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.date().optional(),
);

export const cropSchema = z.object({
  farmId: uuid,
  plotId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  cropName: z.string().trim().min(2).max(120),
  variety: optionalText(120),
  seedQuantity: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive().max(9_999_999).optional(),
  ),
  seedUnit: z.enum(["KG", "BAG", "TONNE", "CRATE", "LITRE", "PIECE"]).optional(),
  plantedAt: optionalDate,
  expectedHarvestAt: optionalDate,
  expectedProduction: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive().max(9_999_999).optional(),
  ),
  note: optionalText(2000),
});

export const activitySchema = z.object({
  cropId: uuid,
  type: z.enum(["PLANTING", "FERTILIZING", "SPRAYING", "IRRIGATION", "HARVEST", "OTHER"]),
  occurredAt: z.coerce.date(),
  note: optionalText(2000),
});

export const expenseSchema = z.object({
  cropId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  category: z.enum([
    "SEED",
    "FERTILIZER",
    "MANURE",
    "LABOUR",
    "TRANSPORT",
    "IRRIGATION",
    "PEST_CONTROL",
    "OTHER",
  ]),
  amount: money,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  occurredAt: z.coerce.date(),
  note: optionalText(500),
});

export const harvestSchema = z.object({
  cropId: uuid,
  harvestedAt: z.coerce.date(),
  quantity: money,
  unit: z.enum(["KG", "BAG", "TONNE", "CRATE", "LITRE", "PIECE"]),
  grade: optionalText(80),
  storageLocation: optionalText(200),
  note: optionalText(2000),
});

export const cropStatusSchema = z.object({
  cropId: uuid,
  status: z.enum(["PLANTED", "GROWING", "CANCELLED"]),
});
