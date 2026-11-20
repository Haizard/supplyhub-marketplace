import { z } from "zod";

export const RETURN_REASONS = [
  "DAMAGED",
  "NOT_AS_DESCRIBED",
  "WRONG_ITEM",
  "CHANGED_MIND",
  "OTHER",
] as const;

export const returnRequestSchema = z.object({
  vendorOrderId: z.uuid({ error: "That studio order could not be found." }),
  note: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500, { error: "Use 500 characters or fewer." }).optional(),
  ),
});

export const returnDecisionSchema = z.object({
  returnId: z.uuid({ error: "That return could not be found." }),
  decision: z.enum(["APPROVED", "REJECTED", "COMPLETED"]),
  vendorNote: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500, { error: "Use 500 characters or fewer." }).optional(),
  ),
});
