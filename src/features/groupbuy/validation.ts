import { z } from "zod";

import { MAX_PRICE_CENTS, parseMoneyToCents } from "@/features/catalog/money";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const moneyField = (label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return null;
      const cents = parseMoneyToCents(value.trim());
      return cents !== null && cents <= MAX_PRICE_CENTS ? cents : null;
    },
    z
      .number()
      .int()
      .nonnegative({ error: `Enter a valid ${label}.` }),
  );

const tierSchema = z.object({
  minQuantity: z.coerce.number().int().positive({ error: "Minimum quantity must be positive." }),
  maxQuantity: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  unitPrice: moneyField("tier price"),
});

export const campaignSchema = z
  .object({
    campaignId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
    vendorId: uuid,
    productId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
    title: z.string().trim().min(2, { error: "Title must be at least 2 characters." }).max(150),
    description: optionalText(2000),
    currency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/, { error: "Currency must be a 3-letter code." }),
    basePrice: moneyField("base price"),
    targetQuantity: z.coerce
      .number()
      .int()
      .positive({ error: "Target quantity must be positive." })
      .max(10000, { error: "Target quantity cannot exceed 10000." }),
    maxQuantity: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.coerce.number().int().positive().max(100000).optional(),
    ),
    startsAt: z.coerce.date({ error: "Enter a valid start date." }),
    endsAt: z.coerce.date({ error: "Enter a valid end date." }),
    tiers: z.array(tierSchema).max(10, { error: "A campaign can have at most 10 tiers." }),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    path: ["endsAt"],
    message: "End date must be after the start date.",
  });

export const participationSchema = z.object({
  campaignId: uuid,
  quantity: z.coerce
    .number()
    .int()
    .positive({ error: "Quantity must be positive." })
    .max(1000, { error: "Quantity cannot exceed 1000." }),
});

export const campaignStatusSchema = z.object({
  id: uuid,
  toStatus: z.enum(["ACTIVE", "CANCELLED"], {
    error: "Invalid status transition.",
  }),
});

export type CampaignInput = z.infer<typeof campaignSchema>;
export type ParticipationInput = z.infer<typeof participationSchema>;
export type CampaignStatusInput = z.infer<typeof campaignStatusSchema>;
export type TierInput = z.infer<typeof tierSchema>;
