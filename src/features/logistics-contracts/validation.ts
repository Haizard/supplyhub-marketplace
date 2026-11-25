import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );
const money = z.coerce.number().nonnegative({ error: "Enter a valid amount." }).max(99_999_999);

export const contractSchema = z
  .object({
    contractId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
    companyId: uuid,
    clientId: uuid,
    type: z.enum(["PER_DELIVERY", "MONTHLY", "VOLUME", "DEDICATED_FLEET", "GEOGRAPHIC", "HYBRID"]),
    title: z.string().trim().min(2).max(150),
    description: optionalText(2000),
    currency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
    startsAt: z.coerce.date(),
    endsAt: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce.date().optional(),
    ),
    monthlyAllocation: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    coverageArea: optionalText(200),
    serviceHours: optionalText(120),
    paymentTerms: optionalText(200),
    mode: z.enum(["PER_DELIVERY", "FLAT_MONTHLY", "TIERED_VOLUME", "PER_KM"]),
    perDelivery: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      money.optional(),
    ),
    monthlyFee: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      money.optional(),
    ),
    perKmRate: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), money.optional()),
    minimumFee: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      money.optional(),
    ),
    includedUnits: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce.number().int().nonnegative().optional(),
    ),
    maxDeliveryHours: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce.number().int().positive().max(720).optional(),
    ),
    minCompletionRateBps: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce.number().int().min(0).max(10000).optional(),
    ),
    proofRequired: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    otpRequired: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    claimsWindowDays: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce.number().int().positive().max(365).optional(),
    ),
  })
  .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
    path: ["endsAt"],
    message: "End date must be after the start date.",
  });

export const contractStatusSchema = z.object({
  contractId: uuid,
  toStatus: z.enum(["PROPOSED", "ACTIVE", "SUSPENDED", "EXPIRED", "TERMINATED"]),
  note: optionalText(1000),
});

export const contractDeliverySchema = z.object({
  contractId: uuid,
  reference: z.string().trim().min(2).max(120),
  charge: money,
  note: optionalText(1000),
});

export const invoiceSchema = z.object({
  contractId: uuid,
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  dueAt: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.date().optional(),
  ),
  note: optionalText(1000),
});

export const invoiceStatusSchema = z.object({
  invoiceId: uuid,
  toStatus: z.enum(["ISSUED", "PAID", "OVERDUE", "CANCELLED"]),
});

export type ContractInput = z.infer<typeof contractSchema>;
export type ContractStatusInput = z.infer<typeof contractStatusSchema>;
export type ContractDeliveryInput = z.infer<typeof contractDeliverySchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type InvoiceStatusInput = z.infer<typeof invoiceStatusSchema>;
