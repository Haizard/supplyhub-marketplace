import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
const positive = z.coerce.number().positive().max(9_999_999);
const coords = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const collectionCentreSchema = z.object({
  name: z.string().trim().min(2).max(160),
  location: z.string().trim().min(3).max(300),
  region: optionalText(120),
  district: optionalText(120),
  capacityKg: positive,
  services: optionalText(500),
});

export const storageFacilitySchema = z.object({
  name: z.string().trim().min(2).max(160),
  location: z.string().trim().min(3).max(300),
  capacityKg: positive,
  coldChain: z.preprocess((value) => value === "true", z.boolean()),
  rateAmount: positive,
  rateUnit: z.string().trim().min(1).max(40),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export const agriculturalDeliverySchema = z.object({
  companyId: uuid,
  cargoType: z.enum(["PRODUCE", "INPUT", "MANURE"]),
  direction: z.enum(["FARM_TO_BUYER", "FARM_TO_CENTRE", "CENTRE_TO_BUYER", "INPUT_TO_FARM"]),
  quantity: positive,
  unit: z.enum(["KG", "BAG", "TONNE", "CRATE", "LITRE", "PIECE"]),
  pickupName: z.string().trim().min(2).max(120),
  pickupAddress: z.string().trim().min(3).max(300),
  pickup: coords,
  dropoffName: z.string().trim().min(2).max(120),
  dropoffAddress: z.string().trim().min(3).max(300),
  dropoff: coords,
  centreId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  facilityId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  note: optionalText(1000),
});

export const intakeSchema = z.object({
  centreId: uuid,
  harvestBatchId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  weighedKg: positive,
  rejectedKg: z.coerce.number().min(0).max(9_999_999),
  grade: optionalText(80),
  moisturePercent: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(0).max(100).optional(),
  ),
  evidenceNote: optionalText(2000),
});

export const intakeDecisionSchema = z.object({
  intakeId: uuid,
  decision: z.enum(["GRADE", "ACCEPT", "REJECT"]),
  note: optionalText(500),
});

export const storageBookingSchema = z.object({
  facilityId: uuid,
  quantityKg: positive,
});

export const storageDecisionSchema = z.object({
  bookingId: uuid,
  decision: z.enum(["STORE", "RELEASE"]),
});
