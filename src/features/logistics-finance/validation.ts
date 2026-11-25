import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );
const optionalMoney = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.coerce.number().nonnegative().max(99_999_999).optional(),
);

export const compensationSchema = z.object({
  companyId: uuid,
  membershipId: uuid,
  mode: z.enum(["FIXED_MONTHLY", "PER_DELIVERY", "PERCENTAGE", "DAILY", "HYBRID"]),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  fixedAmount: optionalMoney,
  perDelivery: optionalMoney,
  rateBps: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(10000).optional(),
  ),
  dailyAmount: optionalMoney,
  effectiveFrom: z.coerce.date(),
  notes: optionalText(1000),
});

export const earningSchema = z.object({
  companyId: uuid,
  membershipId: uuid,
  jobId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  basis: z.string().trim().min(2).max(40),
  amount: z.coerce.number().nonnegative().max(99_999_999),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: optionalText(1000),
});

export const earningStatusSchema = z.object({
  earningId: uuid,
  toStatus: z.enum(["APPROVED", "PAID"], { error: "Invalid earning status." }),
});

export const payoutSchema = z.object({
  companyId: uuid,
  membershipId: uuid,
  amount: z.coerce.number().positive().max(99_999_999),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  note: optionalText(1000),
});

export const payoutStatusSchema = z.object({
  payoutId: uuid,
  toStatus: z.enum(["APPROVED", "PAID", "FAILED"]),
  reference: optionalText(120),
  paymentProof: optionalText(255),
  reason: optionalText(1000),
});

export const expenseSchema = z.object({
  companyId: uuid,
  vehicleId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  category: z.enum([
    "FUEL",
    "MAINTENANCE",
    "INSURANCE",
    "SALARY",
    "RENT",
    "UTILITIES",
    "PLATFORM_FEE",
    "OTHER",
  ]),
  amount: z.coerce.number().nonnegative().max(99_999_999),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  occurredAt: z.coerce.date(),
  reference: optionalText(120),
  note: optionalText(1000),
});

export const settlementSchema = z.object({
  companyId: uuid,
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  note: optionalText(1000),
});

export type CompensationInput = z.infer<typeof compensationSchema>;
export type EarningInput = z.infer<typeof earningSchema>;
export type PayoutInput = z.infer<typeof payoutSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
