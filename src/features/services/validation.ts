import { z } from "zod";

import { MAX_PRICE_CENTS, parseMoneyToCents } from "@/features/catalog/money";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const moneyField = z.preprocess(
  (value) => {
    if (typeof value !== "string") return null;
    const cents = parseMoneyToCents(value.trim());
    return cents !== null && cents <= MAX_PRICE_CENTS ? cents : null;
  },
  z.number().int().nonnegative({ error: "Enter a valid price." }),
);

export const serviceListingSchema = z.object({
  listingId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  vendorId: uuid,
  categoryId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  title: z.string().trim().min(2, { error: "Title must be at least 2 characters." }).max(150),
  description: optionalText(2000),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, { error: "Currency must be a 3-letter code." }),
  unitPrice: moneyField,
  durationMinutes: z.coerce
    .number()
    .int()
    .positive({ error: "Duration must be positive." })
    .max(1440, { error: "Duration cannot exceed 1440 minutes." }),
  location: optionalText(150),
});

export const bookingSchema = z.object({
  listingId: uuid,
  scheduledAt: z.coerce.date({ error: "Enter a valid date and time." }),
  note: optionalText(1000),
});

export const bookingStatusSchema = z.object({
  bookingId: uuid,
  toStatus: z.enum(["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"], {
    error: "Invalid booking status.",
  }),
});

export type ServiceListingInput = z.infer<typeof serviceListingSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type BookingStatusInput = z.infer<typeof bookingStatusSchema>;
