import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

export const fleetSchema = z.object({
  fleetId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  companyId: uuid,
  name: z.string().trim().min(2, "Fleet name is too short.").max(120),
  branchId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
});

export const vehicleSchema = z.object({
  vehicleId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  companyId: uuid,
  fleetId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  plate: z.string().trim().min(2, "Plate is too short.").max(40),
  type: z.enum(["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "TRUCK"]),
  make: optionalText(80),
  model: optionalText(80),
  capacityKg: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().nonnegative().max(100000).optional(),
  ),
  ownership: z.enum(["OWNED", "LEASED", "RENTED"]),
  leaseProvider: optionalText(160),
  insuranceExpiresAt: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.date().optional(),
  ),
  inspectionExpiresAt: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.date().optional(),
  ),
});

export const documentSchema = z.object({
  companyId: uuid,
  vehicleId: uuid,
  type: z.enum(["REGISTRATION", "INSURANCE", "INSPECTION", "OTHER"]),
  reference: optionalText(160),
  storageKey: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9_\-./]+$/, "Invalid storage key."),
  expiresAt: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.date().optional(),
  ),
});

export const documentReviewSchema = z.object({
  documentId: uuid,
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const maintenanceSchema = z.object({
  companyId: uuid,
  vehicleId: uuid,
  performedAt: z.coerce.date(),
  odometerKm: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().int().nonnegative().optional(),
  ),
  cost: z.coerce.number().nonnegative({ error: "Enter a valid cost." }),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  description: z.string().trim().min(2).max(500),
});

export type FleetInput = z.infer<typeof fleetSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;
