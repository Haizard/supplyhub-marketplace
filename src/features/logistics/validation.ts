import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const geoPoint = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const agentRegistrationSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter your full name." }).max(100),
  phone: z.string().trim().min(7, { error: "Enter a reachable phone number." }).max(30),
  vehicleType: z.enum(["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "WALKING"]),
  plate: optionalText(30),
  serviceAreaLabel: z.string().trim().min(2, { error: "Name your service area." }).max(100),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(200),
});

export const agentPresenceSchema = z.object({
  presence: z.enum(["ONLINE", "OFFLINE"]),
});

export const documentUploadSchema = z.object({
  agentId: uuid,
  type: z.enum(["NATIONAL_ID", "DRIVING_LICENSE", "INSURANCE", "PROFILE_PHOTO"]),
  storageKey: z.string().trim().min(1).max(500),
});

export const documentReviewSchema = z.object({
  documentId: uuid,
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const agentReviewSchema = z.object({
  agentId: uuid,
  decision: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
});

export const deliveryRequestSchema = z.object({
  orderId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    uuid.optional(),
  ),
  pickupName: z.string().trim().min(1).max(100),
  pickupPhone: optionalText(30),
  pickupAddress: z.string().trim().min(1).max(300),
  pickup: geoPoint,
  dropoffName: z.string().trim().min(1).max(100),
  dropoffPhone: optionalText(30),
  dropoffAddress: z.string().trim().min(1).max(300),
  dropoff: geoPoint,
  note: optionalText(500),
});

/** External businesses can request a delivery without a marketplace order. */
export const externalDeliveryRequestSchema = z.object({
  externalRef: z.string().trim().min(3).max(120),
  businessId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    uuid.optional(),
  ),
  pickupName: z.string().trim().min(1).max(100),
  pickupPhone: optionalText(30),
  pickupAddress: z.string().trim().min(1).max(300),
  pickup: geoPoint,
  dropoffName: z.string().trim().min(1).max(100),
  dropoffPhone: optionalText(30),
  dropoffAddress: z.string().trim().min(1).max(300),
  dropoff: geoPoint,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: optionalText(500),
});

export const dispatchSchema = z.object({
  requestId: uuid,
});

export const jobTransitionSchema = z.object({
  jobId: uuid,
  /** Only the ACCEPTED..DELIVERED moves need an explicit target; the machine derives the rest. */
  toStatus: z.enum(["ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT", "DELIVERED", "CANCELLED"]),
  note: optionalText(500),
});

export const handoverSchema = z.object({
  jobId: uuid,
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, { error: "Enter the 4 to 8 digit hand-over code." }),
});

export const locationPingSchema = z.object({
  jobId: uuid,
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  heading: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0).max(360).optional(),
  ),
});

export const proofSchema = z.object({
  jobId: uuid,
  type: z.enum(["PHOTO", "SIGNATURE"]),
  storageKey: optionalText(500),
  note: optionalText(500),
});

export const pricingRuleSchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  baseFee: z.coerce.number().min(0),
  perKmRate: z.coerce.number().min(0),
  minimumFee: z.coerce.number().min(0),
  maximumFee: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0).optional(),
  ),
});

export const agentEarningPaidSchema = z.object({
  earningId: uuid,
});
