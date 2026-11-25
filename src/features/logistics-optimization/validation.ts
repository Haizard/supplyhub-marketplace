import { z } from "zod";

const uuid = z.uuid();

export const optimizationRequestSchema = z.object({
  companyId: uuid,
  requestId: uuid,
});

export const optimizationDecisionSchema = z.object({
  companyId: uuid,
  suggestionId: uuid,
  decision: z.enum(["ACCEPT", "REJECT", "USE_BASELINE"]),
});
