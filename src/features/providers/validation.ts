import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(3).max(max).optional(),
  );

const providerType = z.enum(["FARMER", "LOGISTICS_COMPANY", "SERVICE_PROVIDER"]);

/**
 * The form offers one combined choice (`TYPE:entityId`) because a person can
 * run more than one provider identity. The transform splits it so the action
 * never has to parse untrusted input by hand.
 */
export const providerApplicationSchema = z.object({
  entity: z
    .string()
    .trim()
    .regex(
      /^(FARMER|LOGISTICS_COMPANY|SERVICE_PROVIDER):[0-9a-fA-F-]{36}$/,
      "Choose which provider to apply for.",
    )
    .transform((value) => {
      const separator = value.indexOf(":");
      return {
        providerType: providerType.parse(value.slice(0, separator)),
        entityId: value.slice(separator + 1),
      };
    }),
  displayName: z.string().trim().min(2, "Enter the public provider name.").max(160),
  contactPhone: z.string().trim().min(7, "Enter a reachable phone number.").max(40),
  contactEmail: z.email("Enter a valid email address.").max(160),
  district: optionalText(120),
  summary: z.string().trim().min(30, "Describe the operation in at least 30 characters.").max(1000),
  identityReference: z.string().trim().min(3, "Enter the ID or registration reference.").max(160),
  licenceReference: optionalText(160),
  certificateReference: optionalText(160),
});

export const providerReviewSchema = z
  .object({
    applicationId: z.uuid(),
    decision: z.enum(["APPROVED", "REJECTED"], { error: "Choose a decision." }),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "REJECTED" && (value.note?.length ?? 0) < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Explain what the provider must fix.",
      });
    }
  });

export type ProviderApplicationInput = z.infer<typeof providerApplicationSchema>;
