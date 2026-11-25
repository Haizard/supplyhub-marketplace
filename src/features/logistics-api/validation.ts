import { z } from "zod";

const uuid = z.uuid();

export const apiKeySchema = z.object({
  companyId: uuid,
  name: z.string().trim().min(2).max(120),
  scopes: z
    .array(z.enum(["delivery.requests:write", "delivery.requests:read", "webhooks:write"]))
    .min(1)
    .max(3),
});

export const webhookEndpointSchema = z.object({
  companyId: uuid,
  url: z
    .url({ error: "Enter a valid HTTPS URL." })
    .refine((value) => value.startsWith("https://"), { message: "Webhook URLs must use HTTPS." }),
  events: z
    .array(z.enum(["delivery.created", "delivery.status_changed", "delivery.delivered"]))
    .min(1),
});

export const externalStoreSchema = z.object({
  companyId: uuid,
  platform: z.string().trim().min(2).max(60),
  externalStoreId: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(160),
});

/** External store -> SupplyHub order webhook body. */
export const externalOrderSchema = z.object({
  externalOrderId: z.string().trim().min(2).max(120),
  customerName: z.string().trim().min(2).max(160),
  customerPhone: z.string().trim().max(40).optional(),
  pickupName: z.string().trim().min(2).max(160),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupLatitude: z.coerce.number().min(-90).max(90),
  pickupLongitude: z.coerce.number().min(-180).max(180),
  dropoffName: z.string().trim().min(2).max(160),
  dropoffAddress: z.string().trim().min(3).max(300),
  dropoffLatitude: z.coerce.number().min(-90).max(90),
  dropoffLongitude: z.coerce.number().min(-180).max(180),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  fee: z.coerce.number().nonnegative().max(99_999_999),
  distanceKm: z.coerce.number().nonnegative().max(5000),
  note: z.string().trim().max(500).optional(),
});

/** Third-party API delivery request body. Fees/pricing stay server-authoritative. */
export const apiDeliveryRequestSchema = z.object({
  externalRef: z.string().trim().min(3).max(120),
  pickupName: z.string().trim().min(2).max(100),
  pickupPhone: z.string().trim().max(40).optional(),
  pickupAddress: z.string().trim().min(3).max(300),
  pickup: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  dropoffName: z.string().trim().min(2).max(100),
  dropoffPhone: z.string().trim().max(40).optional(),
  dropoffAddress: z.string().trim().min(3).max(300),
  dropoff: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: z.string().trim().max(500).optional(),
});

export const revokeKeySchema = z.object({ keyId: uuid });
export const endpointStatusSchema = z.object({
  endpointId: uuid,
  status: z.enum(["ACTIVE", "PAUSED"]),
});
