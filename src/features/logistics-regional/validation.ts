import { z } from "zod";

import { MAX_PRICE_CENTS, parseMoneyToCents } from "@/features/catalog/money";

const moneyField = z.preprocess((value) => {
  if (typeof value !== "string") return null;
  const cents = parseMoneyToCents(value.trim());
  return cents !== null && cents <= MAX_PRICE_CENTS ? cents : null;
}, z.number().int().nonnegative());

export const corridorSchema = z.object({
  corridorId: z.uuid().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(150),
  description: z.string().trim().max(1000).optional(),
  originBranchId: z.uuid(),
  destBranchId: z.uuid(),
  currency: z.string().trim().toUpperCase().length(3, "Currency must be a 3-letter code."),
  baseFee: moneyField,
  perKmFee: moneyField,
  estimatedKm: z.coerce.number().int().min(1).max(5000),
  estimatedHours: z.coerce.number().int().min(1).max(72),
  stops: z
    .array(
      z.object({
        branchId: z.uuid(),
        stopOrder: z.coerce.number().int().positive(),
        label: z.string().trim().max(80).optional(),
      }),
    )
    .max(10, "A corridor can have at most 10 stops."),
});

export type CorridorInput = z.infer<typeof corridorSchema>;

export const corridorStatusSchema = z.object({
  id: z.uuid(),
  toStatus: z.enum(["ACTIVE", "INACTIVE"]),
});

export type CorridorStatusInput = z.infer<typeof corridorStatusSchema>;
