import { z } from "zod";

const uuid = z.uuid();

export const openDisputeSchema = z.object({
  orderId: uuid,
  vendorOrderId: uuid,
  reason: z.string().trim().min(3, "Give a short reason.").max(160),
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters.")
    .max(4000),
});

export const disputeMessageSchema = z.object({
  disputeId: uuid,
  body: z.string().trim().min(1, "Write a message.").max(2000),
});

export const disputeStatusSchema = z
  .object({
    disputeId: uuid,
    toStatus: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"], {
      error: "Invalid dispute status.",
    }),
    resolutionNote: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.toStatus !== "UNDER_REVIEW" || !data.resolutionNote, {
    path: ["resolutionNote"],
    message: "A resolution note is only needed when closing a dispute.",
  })
  .refine((data) => data.toStatus === "UNDER_REVIEW" || Boolean(data.resolutionNote), {
    path: ["resolutionNote"],
    message: "Explain the decision before closing the dispute.",
  });

export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
export type DisputeMessageInput = z.infer<typeof disputeMessageSchema>;
export type DisputeStatusInput = z.infer<typeof disputeStatusSchema>;
