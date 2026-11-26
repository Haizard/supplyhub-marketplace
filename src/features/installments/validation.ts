import { z } from "zod";

const uuid = z.uuid();
const checkbox = z.preprocess((value) => value === "true", z.boolean());
export const installmentSettingsSchema = z.object({
  businessId: uuid,
  enabled: checkbox,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code."),
  defaultDepositMode: z.enum(["FIXED", "PERCENTAGE"]),
  defaultDepositValue: z.coerce.number().positive().max(1_000_000),
  defaultFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  defaultInstallmentCount: z.coerce.number().int().min(1).max(60),
  defaultPossession: z.enum(["IMMEDIATE", "AFTER_FULL_PAYMENT"]),
  gracePeriodDays: z.coerce.number().int().min(0).max(365),
  maxInstallments: z.coerce.number().int().min(1).max(60),
  allowInterest: checkbox,
  allowLateFees: checkbox,
  allowAdvancePayments: checkbox,
  termsSummary: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(2000).optional(),
  ),
});

export const createInstallmentAgreementSchema = z.object({
  businessId: uuid,
  buyerEmail: z.email(),
  source: z.enum(["MARKETPLACE", "OFFLINE"]),
  orderId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  itemName: z.string().trim().min(2).max(200),
  productId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  sku: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(80).optional(),
  ),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: z.coerce.number().min(0).max(99_999_999),
  depositMode: z.enum(["FIXED", "PERCENTAGE"]),
  depositValue: z.coerce.number().positive().max(1_000_000),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  installmentCount: z.coerce.number().int().min(1).max(60),
  possessionModel: z.enum(["IMMEDIATE", "AFTER_FULL_PAYMENT"]),
  firstDueDate: z.coerce.date({ error: "Enter the first due date." }),
  notes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(1000).optional(),
  ),
  latePaymentPolicy: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
});

export const acceptInstallmentSchema = z.object({ agreementId: uuid });

export const cancelInstallmentSchema = z.object({
  businessId: uuid,
  agreementId: uuid,
  reason: z.string().trim().min(5).max(500),
});

export const startInstallmentPaymentSchema = z.object({
  agreementId: uuid,
  amount: z.coerce.number().positive().max(99_999_999),
  method: z.enum(["MPESA", "TIGOPESA", "AIRTEL", "HALOPESA", "CARD"]),
  phone: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
});

export const recordInstallmentCashSchema = z.object({
  businessId: uuid,
  agreementId: uuid,
  amount: z.coerce.number().positive().max(99_999_999),
  method: z.enum(["CASH", "BANK"]),
  note: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
});

export const refundInstallmentSchema = z.object({
  businessId: uuid,
  paymentId: uuid,
  reason: z.string().trim().min(5).max(500),
});

export const openInstallmentDisputeSchema = z.object({
  businessId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  agreementId: uuid,
  paymentId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  reason: z.string().trim().min(10).max(2000),
});

export const resolveInstallmentDisputeSchema = z.object({
  businessId: uuid,
  disputeId: uuid,
  decision: z.enum(["RESOLVE", "REJECT"]),
  resolution: z.string().trim().min(10).max(2000),
});

export const createInstallmentDocumentSchema = z.object({
  businessId: uuid,
  agreementId: uuid,
});

export const signInstallmentDocumentSchema = z.object({
  businessId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  documentId: uuid,
});

export const voidInstallmentDocumentSchema = z.object({
  businessId: uuid,
  documentId: uuid,
});

export const proposeInstallmentAmendmentSchema = z.object({
  businessId: uuid,
  agreementId: uuid,
  reason: z.string().trim().min(10).max(2000),
});

export const decideInstallmentAmendmentSchema = z.object({
  amendmentId: uuid,
  decision: z.enum(["ACCEPT", "REJECT"]),
});

export const submitInstallmentFinancingSchema = z.object({
  businessId: uuid,
  agreementId: uuid,
  partnerCode: z.string().trim().min(2).max(60),
  requestedAmount: z.coerce.number().positive().max(99_999_999),
});

export const decideInstallmentFinancingSchema = z.object({
  applicationId: uuid,
  decision: z.enum(["APPROVE", "DECLINE"]),
  note: z.string().trim().min(10).max(2000),
  offeredAmount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive().max(99_999_999).optional(),
  ),
});

export const acceptInstallmentFinancingSchema = z.object({ applicationId: uuid });

export const fundInstallmentFinancingSchema = z.object({
  applicationId: uuid,
  providerReference: z.string().trim().min(3).max(160),
});
