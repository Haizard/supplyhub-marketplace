import { z } from "zod";

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.uuid({ error: "Choose a target." }).optional(),
);

const optionalDate = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  },
  z.date({ error: "Enter a valid date and time." }).optional(),
);

export const promotionInputSchema = z
  .object({
    name: z.preprocess(
      trimmed,
      z
        .string({ error: "Name the promotion." })
        .min(2, { error: "Use at least 2 characters." })
        .max(80, { error: "Use 80 characters or fewer." }),
    ),
    description: z.preprocess(
      trimmed,
      z.string().max(160, { error: "Use 160 characters or fewer." }).default(""),
    ),
    scope: z.enum(["MARKETPLACE", "VENDOR", "CATEGORY"], {
      error: "Choose where the promotion applies.",
    }),
    vendorId: optionalUuid,
    categoryId: optionalUuid,
    percent: z.preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
      z
        .number({ error: "Enter a percentage." })
        .int({ error: "Use a whole percentage." })
        .min(1, { error: "Use at least 1%." })
        .max(90, { error: "Use 90% or less." }),
    ),
    currency: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
      z
        .string({ error: "Enter a currency." })
        .regex(/^[A-Z]{3}$/, { error: "Use a three-letter currency code." }),
    ),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .superRefine((value, context) => {
    if (value.scope === "VENDOR" && !value.vendorId) {
      context.addIssue({ code: "custom", path: ["vendorId"], message: "Choose a studio." });
    }
    if (value.scope === "CATEGORY" && !value.categoryId) {
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Choose a department.",
      });
    }
    if (value.startsAt && value.endsAt && value.endsAt.getTime() <= value.startsAt.getTime()) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The end must come after the start.",
      });
    }
  });

export type PromotionInput = z.infer<typeof promotionInputSchema>;
