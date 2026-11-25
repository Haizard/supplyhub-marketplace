import { z } from "zod";

const uuid = z.uuid();
const currency = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/);

export const shareOfferSchema = z
  .object({
    companyId: uuid,
    partnerCompanyCode: z.string().trim().min(2).max(40),
    type: z.enum(["VEHICLE_LENDING", "SUBCONTRACT_DELIVERY"]),
    accountable: z.enum(["OWNER", "PARTNER"]),
    insurancePolicyRef: z.string().trim().min(2).max(160),
    insuranceExpiresAt: z.coerce.date({ error: "Enter the insurance expiry date." }),
    effectiveFrom: z.coerce.date({ error: "Enter the effective start date." }),
    effectiveTo: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.date({ error: "Enter a valid end date." }).optional(),
    ),
    rateAmount: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().nonnegative().max(99_999_999).optional(),
    ),
    rateCurrency: z.preprocess((value) => (value === "" ? undefined : value), currency.optional()),
    liabilityTerms: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().trim().max(1000).optional(),
    ),
    vehicleIds: z.array(uuid).min(1).max(50),
  })
  .refine((value) => value.effectiveTo === undefined || value.effectiveTo > value.effectiveFrom, {
    message: "The end date must be after the start date.",
    path: ["effectiveTo"],
  })
  .refine((value) => value.insuranceExpiresAt > new Date(), {
    message: "Insurance must still be valid.",
    path: ["insuranceExpiresAt"],
  });

export const shareResponseSchema = z.object({
  companyId: uuid,
  agreementId: uuid,
  decision: z.enum(["ACCEPT", "DECLINE"]),
});

export const shareStatusSchema = z.object({
  companyId: uuid,
  agreementId: uuid,
  action: z.enum(["SUSPEND", "RESUME", "TERMINATE"]),
  reason: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
});

export const shareVehicleSchema = z.object({
  companyId: uuid,
  agreementId: uuid,
  vehicleId: uuid,
  active: z.enum(["true", "false"]),
});

export const shareUsageSchema = z.object({
  companyId: uuid,
  agreementId: uuid,
  vehicleId: uuid,
  jobId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
});

export const releaseUsageSchema = z.object({
  companyId: uuid,
  usageId: uuid,
});

export const hubSchema = z.object({
  companyId: uuid,
  hubCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers or dashes."),
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(3).max(300),
  city: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(120).optional(),
  ),
  latitude: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(-180).max(180).optional(),
  ),
  capacity: z.coerce.number().int().min(1).max(100_000),
});

export const hubIntakeSchema = z.object({
  companyId: uuid,
  hubId: uuid,
  trackingRef: z.string().trim().min(2).max(120),
  direction: z.enum(["INTAKE", "COLLECTION"]),
  jobId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  notes: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
});

export const hubReleaseSchema = z.object({
  companyId: uuid,
  handoverId: uuid,
  pickupCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit pickup code."),
  releasedToName: z.string().trim().min(2).max(160),
  releasedToPhone: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
});

export type ShareOfferInput = z.infer<typeof shareOfferSchema>;
export type HubInput = z.infer<typeof hubSchema>;
