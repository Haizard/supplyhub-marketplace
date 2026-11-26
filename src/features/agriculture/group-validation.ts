import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
const positive = z.coerce.number().positive().max(9_999_999);

export const farmerGroupSchema = z.object({
  name: z.string().trim().min(2).max(160),
  registrationNumber: optionalText(120),
  region: optionalText(120),
  district: optionalText(120),
  description: optionalText(2000),
});

export const groupMemberSchema = z.object({
  groupId: uuid,
  farmerId: uuid,
  action: z.enum(["ADD", "REMOVE"]),
});

export const harvestAgreementSchema = z.object({
  farmerId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  groupId: z.preprocess((value) => (value === "" ? undefined : value), uuid.optional()),
  cropName: z.string().trim().min(2).max(120),
  variety: optionalText(120),
  expectedQuantity: positive,
  unit: z.enum(["KG", "BAG", "TONNE", "CRATE", "LITRE", "PIECE"]),
  qualitySpec: optionalText(2000),
  pricePerUnit: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive().max(99_999_999).optional(),
  ),
  pricingFormula: optionalText(300),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  deliveryDate: z.coerce.date(),
  collectionLocation: z.string().trim().min(3).max(300),
  paymentTerms: z.string().trim().min(5).max(2000),
  variancePolicy: optionalText(2000),
});

export const acceptAgreementSchema = z.object({
  agreementId: uuid,
  phone: z.string().trim().min(9).max(20).optional(),
});

export const harvestDeliverySchema = z.object({
  agreementId: uuid,
  deliveredQuantity: positive,
  grade: optionalText(80),
  note: optionalText(2000),
});

export const agreementStatusSchema = z.object({
  agreementId: uuid,
  decision: z.enum(["COMPLETE", "DISPUTE", "CANCEL"]),
  note: optionalText(500),
});
