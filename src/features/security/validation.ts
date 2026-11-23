import { z } from "zod";

import { phoneNumberSchema } from "@/features/identity/validation";

export const totpCodeSchema = z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit code." });

export const secondFactorCodeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]/g, "") : value),
  z.string().regex(/^(?:\d{6}|[A-Z0-9]{10})$/, {
    error: "Enter a 6-digit authenticator code or a 10-character backup code.",
  }),
);

export const sendPhoneCodeSchema = z.object({
  phone: phoneNumberSchema,
});

export const verifyPhoneCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit code." }),
});
