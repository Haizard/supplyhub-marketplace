import { z } from "zod";

import { coverImageUrlSchema } from "@/features/marketplaces/images";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
const money = z.coerce.number().positive().max(99_999_999);
const unit = z.enum(["KG", "BAG", "TONNE", "CRATE", "LITRE", "PIECE"]);

export const farmerProfileSchema = z.object({
  phone: optionalText(40),
  region: optionalText(120),
  district: optionalText(120),
  ward: optionalText(120),
  village: optionalText(120),
  note: optionalText(2000),
});

export const farmSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sizeValue: money,
  sizeUnit: z.enum(["ACRE", "HECTARE"]),
  ownership: z.enum(["OWNED", "LEASED"]),
  region: optionalText(120),
  district: optionalText(120),
  ward: optionalText(120),
  village: optionalText(120),
  waterSource: optionalText(200),
  soilInfo: optionalText(300),
});

export const plotSchema = z.object({
  farmId: uuid,
  name: z.string().trim().min(2).max(120),
  sizeValue: money,
  sizeUnit: z.enum(["ACRE", "HECTARE"]),
  boundaryNotes: optionalText(500),
  latitude: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(-180).max(180).optional(),
  ),
  cropVarieties: optionalText(300),
});

export const listingSchema = z.object({
  farmId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  plotId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  buyerUserId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  cropName: z.string().trim().min(2).max(120),
  variety: optionalText(120),
  quantity: money,
  unit,
  pricePerUnit: money,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  minimumOrder: money,
  grade: optionalText(80),
  harvestDate: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.date().optional(),
  ),
  collectionLocation: z.string().trim().min(3).max(300),
  deliveryAvailable: z.preprocess((value) => value === "true", z.boolean()),
  organicClaim: z.preprocess((value) => value === "true", z.boolean()),
  certifiedClaim: z.preprocess((value) => value === "true", z.boolean()),
  coverImageUrl: coverImageUrlSchema,
});

export const buyerRequestSchema = z.object({
  productName: z.string().trim().min(2).max(120),
  quantity: money,
  unit,
  qualitySpec: optionalText(2000),
  deliveryLocation: z.string().trim().min(3).max(300),
  deliveryDeadline: z.coerce.date(),
  offerDeadline: z.coerce.date(),
});

export const offerSchema = z.object({
  listingId: uuid,
  requestId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  quantity: money,
  unit,
  pricePerUnit: money,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: optionalText(500),
});

export const decideOfferSchema = z.object({
  offerId: uuid,
  decision: z.enum(["ACCEPT", "REJECT"]),
  phone: z.string().trim().min(9).max(20).optional(),
});

export const verifyFarmerSchema = z.object({
  farmerId: uuid,
  decision: z.enum(["VERIFY", "REJECT"]),
  note: optionalText(500),
});
