import { z } from "zod";

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value.getTime()), {
      error: "Use a valid date and time.",
    }),
);

const moneyOrPercent = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, { error: "Use a number with up to two decimals." });

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, { error: "Use at least 3 characters." })
      .max(32, { error: "Use 32 characters or fewer." })
      .regex(/^[A-Za-z0-9-]+$/, { error: "Use letters, numbers, and hyphens only." }),
    description: z
      .string()
      .trim()
      .min(3, { error: "Describe what the code is for." })
      .max(120, { error: "Use 120 characters or fewer." }),
    kind: z.enum(["PERCENT", "FIXED"]),
    value: moneyOrPercent,
    currency: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
      z.string().regex(/^[A-Z]{3}$/, { error: "Use a three-letter currency code." }),
    ),
    minSubtotal: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      moneyOrPercent.optional(),
    ),
    maxRedemptions: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.coerce
        .number({ error: "Use a whole number." })
        .int({ error: "Use a whole number." })
        .min(1, { error: "Use at least 1." })
        .max(1_000_000, { error: "Use 1,000,000 or fewer." })
        .optional(),
    ),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .superRefine((value, context) => {
    if (value.kind === "PERCENT" && Number(value.value) > 100) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "A percentage cannot exceed 100.",
      });
    }

    if (Number(value.value) <= 0) {
      context.addIssue({ code: "custom", path: ["value"], message: "Use a value above zero." });
    }

    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The end must be after the start.",
      });
    }
  });

export type CouponInput = z.infer<typeof couponInputSchema>;
