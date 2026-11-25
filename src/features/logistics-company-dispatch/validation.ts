import { z } from "zod";

const uuid = z.uuid();

export const companyRequestSchema = z.object({
  companyId: uuid,
  contractId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  pickupName: z.string().trim().min(2).max(120),
  pickupPhone: z.string().trim().max(40).optional(),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupLatitude: z.coerce.number().min(-90).max(90),
  pickupLongitude: z.coerce.number().min(-180).max(180),
  dropoffName: z.string().trim().min(2).max(120),
  dropoffPhone: z.string().trim().max(40).optional(),
  dropoffAddress: z.string().trim().min(3).max(300),
  dropoffLatitude: z.coerce.number().min(-90).max(90),
  dropoffLongitude: z.coerce.number().min(-180).max(180),
  distanceKm: z.coerce.number().nonnegative().max(5000),
  fee: z.coerce.number().nonnegative().max(99_999_999),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  note: z.string().trim().max(1000).optional(),
});

export const dispatchSchema = z.object({
  companyId: uuid,
  requestId: uuid,
});

export const reassignSchema = z.object({
  companyId: uuid,
  jobId: uuid,
  membershipId: uuid,
});

export const jobStatusSchema = z.object({
  companyId: uuid,
  jobId: uuid,
  toStatus: z.enum(["ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT", "DELIVERED", "CANCELLED"]),
  note: z.string().trim().max(500).optional(),
});

export type CompanyRequestInput = z.infer<typeof companyRequestSchema>;
export type JobStatusInput = z.infer<typeof jobStatusSchema>;
