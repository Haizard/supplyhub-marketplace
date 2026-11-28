import { z } from "zod";

const uuid = z.uuid();

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  uuid.optional(),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date().optional(),
);

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

/**
 * One checkout-style step: the order to connect, the delivery company that
 * takes the job, and an optional service booking. Every price is re-read from
 * the database, never trusted from the form.
 */
export const createTransactionSchema = z
  .object({
    orderNumber: z.string().trim().min(1).max(40),
    companyId: uuid,
    serviceListingId: optionalUuid,
    scheduledAt: optionalDate,
    pickupName: z.string().trim().min(1, "Name the pickup point.").max(100),
    pickupAddress: z.string().trim().min(1, "Enter the pickup address.").max(300),
    pickupLatitude: latitude,
    pickupLongitude: longitude,
    dropoffName: z.string().trim().min(1, "Name the drop-off point.").max(100),
    dropoffAddress: z.string().trim().min(1, "Enter the drop-off address.").max(300),
    dropoffLatitude: latitude,
    dropoffLongitude: longitude,
    note: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.serviceListingId && !value.scheduledAt) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "Choose when the service should happen.",
      });
    }
  });

export const cancelTransactionSchema = z.object({
  transactionId: uuid,
  orderNumber: z.string().trim().min(1).max(40),
  reason: optionalText(300),
});

export const completeTransactionSchema = z.object({
  transactionId: uuid,
  orderNumber: z.string().trim().min(1).max(40),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
