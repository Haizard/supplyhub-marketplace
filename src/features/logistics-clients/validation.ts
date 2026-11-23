import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

export const clientSchema = z.object({
  clientId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  companyId: uuid,
  name: z.string().trim().min(2, "Client name is too short.").max(160),
  businessName: optionalText(160),
  phone: optionalText(40),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  address: optionalText(300),
  city: optionalText(120),
  latitude: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().min(-180).max(180).optional(),
  ),
  accountCode: optionalText(64),
  serviceNotes: optionalText(2000),
});

export const contactSchema = z.object({
  companyId: uuid,
  clientId: uuid,
  contactId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  name: z.string().trim().min(2, "Contact name is too short.").max(120),
  role: optionalText(80),
  phone: optionalText(40),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  isPrimary: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const relationshipStatusSchema = z.object({
  companyId: uuid,
  clientId: uuid,
  toStatus: z.enum(["ACTIVE", "SUSPENDED", "ENDED"], { error: "Invalid relationship status." }),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type RelationshipStatusInput = z.infer<typeof relationshipStatusSchema>;
