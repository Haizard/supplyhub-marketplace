import { z } from "zod";

const uuid = z.uuid();

export const referralSchema = z.object({
  companyId: uuid,
  label: z.string().trim().min(2, "Give the referral link a label.").max(120),
  code: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes."),
});

export const registerReferralSchema = z.object({
  referralId: uuid,
  clientId: uuid,
});

export const rewardStatusSchema = z.object({
  rewardId: uuid,
  toStatus: z.enum(["ELIGIBLE", "PAID", "INELIGIBLE"], { error: "Invalid reward status." }),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type ReferralInput = z.infer<typeof referralSchema>;
export type RegisterReferralInput = z.infer<typeof registerReferralSchema>;
