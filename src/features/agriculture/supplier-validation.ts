import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
const money = z.coerce.number().positive().max(99_999_999);
const unit = z.enum(["KG", "BAG", "TONNE", "CRATE", "LITRE", "PIECE"]);

export const supplierProfileSchema = z.object({
  type: z.enum(["INPUT", "SERVICE", "BOTH"]),
  businessName: z.string().trim().min(2).max(160),
  registrationNumber: optionalText(120),
  licenseReference: optionalText(160),
  insuranceReference: optionalText(160),
  phone: optionalText(40),
  region: optionalText(120),
  district: optionalText(120),
});

export const inputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.enum([
    "SEED",
    "FERTILIZER",
    "MANURE_COMPOST",
    "CROP_PROTECTION",
    "ANIMAL_FEED",
    "VETERINARY",
    "TOOL",
    "IRRIGATION",
    "EQUIPMENT",
    "OTHER",
  ]),
  description: optionalText(2000),
  quantity: money,
  unit,
  pricePerUnit: money,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  minimumOrder: money,
  treatmentStatus: optionalText(160),
  registrationRef: optionalText(160),
  safetyNotes: optionalText(2000),
  organicClaim: z.preprocess((value) => value === "true", z.boolean()),
});

export const serviceSchema = z.object({
  serviceType: z.enum([
    "TRACTOR",
    "PLOUGHING",
    "PLANTING",
    "SPRAYING",
    "HARVESTING",
    "IRRIGATION",
    "SOIL_TESTING",
    "AGRONOMY",
    "TRANSPORT",
    "STORAGE",
    "LABOUR",
  ]),
  title: z.string().trim().min(2).max(160),
  description: optionalText(2000),
  rateAmount: money,
  rateUnit: z.string().trim().min(1).max(40),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  serviceArea: optionalText(200),
  qualificationRef: optionalText(160),
});

export const verifySupplierSchema = z.object({
  supplierId: uuid,
  decision: z.enum(["VERIFY", "REJECT"]),
  note: optionalText(500),
});

export const bookingRequestSchema = z.object({
  serviceId: uuid,
  requestedFor: z.coerce.date(),
  note: optionalText(500),
});

export const bookingQuoteSchema = z.object({
  bookingId: uuid,
  quoteAmount: money,
  scheduledAt: z.coerce.date(),
  note: optionalText(500),
});

export const bookingDecisionSchema = z.object({
  bookingId: uuid,
  decision: z.enum(["CONFIRM", "START", "COMPLETE", "CANCEL"]),
  reason: optionalText(500),
});

export const inputOrderSchema = z.object({
  inputId: uuid,
  quantity: money,
  phone: z.string().trim().min(9).max(20).optional(),
});
