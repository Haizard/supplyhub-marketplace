import { z } from "zod";

export const documentTypeSchema = z.enum([
  "BUSINESS_REGISTRATION",
  "TAX_ID",
  "ID_DOCUMENT",
  "BANK_STATEMENT",
  "OTHER",
]);

export const verificationDocumentSchema = z.object({
  businessId: z.uuid(),
  documentType: documentTypeSchema,
  reference: z.string().trim().min(2, "Enter a document reference.").max(160),
  storageKey: z
    .string()
    .trim()
    .min(1, "Enter the uploaded file key.")
    .max(255)
    .regex(/^[A-Za-z0-9_\-./]+$/, "Invalid file key."),
});

export const verificationReviewSchema = z.object({
  documentId: z.uuid(),
  decision: z.enum(["APPROVED", "REJECTED"], { error: "Choose a decision." }),
  note: z.string().trim().max(1000).optional(),
});

export type VerificationDocumentInput = z.infer<typeof verificationDocumentSchema>;
export type VerificationReviewInput = z.infer<typeof verificationReviewSchema>;
