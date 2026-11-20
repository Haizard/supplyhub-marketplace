import { z } from "zod";

import { MAX_PRICE_CENTS, parseMoneyToCents } from "@/features/catalog/money";

const moneyField = z
  .string()
  .trim()
  .min(1, { error: "Enter an amount." })
  .refine(
    (value) => {
      const cents = parseMoneyToCents(value);
      return cents !== null && cents > 0 && cents <= MAX_PRICE_CENTS;
    },
    { error: "Enter a valid amount." },
  );

const optionalMoneyField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? "0" : value),
  z
    .string()
    .trim()
    .refine(
      (value) => {
        const cents = parseMoneyToCents(value);
        return cents !== null && cents >= 0 && cents <= MAX_PRICE_CENTS;
      },
      { error: "Enter a valid amount." },
    ),
);

export const saleLineSchema = z.object({
  productId: z.uuid({ error: "Choose an object." }),
  variantId: z.uuid({ error: "Choose an option." }).nullish(),
  quantity: z.coerce
    .number()
    .int({ error: "Enter a whole number of units." })
    .min(1, { error: "Sell at least one unit." })
    .max(99, { error: "Sell at most 99 units per line." }),
});

export const posItemsSchema = z
  .array(saleLineSchema)
  .min(1, { error: "Add at least one object to the sale." })
  .max(20, { error: "A sale can hold at most 20 lines." });

export const recordSaleSchema = z.object({
  items: z.string().transform((value, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "The sale lines are invalid." });
      return z.NEVER;
    }

    const result = posItemsSchema.safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "The sale lines are invalid." });
      return z.NEVER;
    }

    return result.data;
  }),
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "OTHER"]),
  tendered: optionalMoneyField,
  reference: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const openSessionSchema = z.object({
  openingFloat: optionalMoneyField,
});

export const closeSessionSchema = z.object({
  countedCash: z
    .string()
    .trim()
    .min(1, { error: "Enter the counted cash." })
    .refine(
      (value) => {
        const cents = parseMoneyToCents(value);
        return cents !== null && cents <= MAX_PRICE_CENTS;
      },
      { error: "Enter a valid amount." },
    ),
  notes: z
    .string()
    .trim()
    .max(300, { error: "Use 300 characters or fewer." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const expenseSchema = z.object({
  category: z
    .string()
    .trim()
    .min(2, { error: "Use at least 2 characters." })
    .max(60, { error: "Use 60 characters or fewer." }),
  description: z
    .string()
    .trim()
    .min(2, { error: "Use at least 2 characters." })
    .max(200, { error: "Use 200 characters or fewer." }),
  amount: moneyField,
});

export type RecordSaleInput = z.infer<typeof recordSaleSchema>;
