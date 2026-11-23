"use server";

import { revalidatePath } from "next/cache";

import { requireActor } from "@/server/auth/guards";
import { AUTH_RATE_LIMITS } from "@/server/security/auth-rate-limits";
import { consumeRateLimit } from "@/server/security/rate-limit";

import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  getSecurityStatus,
  regenerateBackupCodes,
  sendPhoneVerification,
  startTwoFactorSetup,
  verifyPhoneVerification,
} from "./service";
import { secondFactorCodeSchema, sendPhoneCodeSchema, verifyPhoneCodeSchema } from "./validation";

export type SecurityActionResult = {
  ok: boolean;
  message: string;
  secret?: string;
  backupCodes?: string[];
  phone?: string;
};

function refreshSecurity(): void {
  revalidatePath("/account/security");
  revalidatePath("/account");
}

export async function startTwoFactorSetupAction(): Promise<SecurityActionResult> {
  const actor = await requireActor("/account/security");

  if (!consumeRateLimit(`2fa:setup:${actor.id}`, AUTH_RATE_LIMITS.twoFactorByUser)) {
    return { ok: false, message: "Too many security changes. Wait a few minutes." };
  }

  const status = await getSecurityStatus(actor.id);
  if (status?.twoFactorEnabled) {
    return { ok: false, message: "Two-factor authentication is already enabled." };
  }

  const setup = await startTwoFactorSetup(actor.id);
  refreshSecurity();

  return {
    ok: true,
    message: "Add this secret to your authenticator app, then enter a code to enable 2FA.",
    secret: setup.secret,
    backupCodes: setup.backupCodes,
  };
}

export async function confirmTwoFactorSetupAction(code: string): Promise<SecurityActionResult> {
  const actor = await requireActor("/account/security");

  if (!consumeRateLimit(`2fa:confirm:${actor.id}`, AUTH_RATE_LIMITS.twoFactorByUser)) {
    return { ok: false, message: "Too many attempts. Wait a few minutes." };
  }

  const parsed = secondFactorCodeSchema.safeParse(code);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid 6-digit authenticator code." };
  }

  if (!(await confirmTwoFactorSetup(actor.id, parsed.data))) {
    return { ok: false, message: "That code is invalid or has already been used." };
  }

  refreshSecurity();
  return { ok: true, message: "Two-factor authentication is enabled." };
}

export async function disableTwoFactorAction(code: string): Promise<SecurityActionResult> {
  const actor = await requireActor("/account/security");

  if (!consumeRateLimit(`2fa:disable:${actor.id}`, AUTH_RATE_LIMITS.twoFactorByUser)) {
    return { ok: false, message: "Too many attempts. Wait a few minutes." };
  }

  const parsed = secondFactorCodeSchema.safeParse(code);
  if (!parsed.success) {
    return { ok: false, message: "Enter a current code or an unused backup code." };
  }

  if (!(await disableTwoFactor(actor.id, parsed.data))) {
    return { ok: false, message: "That code is invalid, replayed, or belongs to another account." };
  }

  refreshSecurity();
  return { ok: true, message: "Two-factor authentication is disabled. Sign in again." };
}

export async function regenerateBackupCodesAction(code: string): Promise<SecurityActionResult> {
  const actor = await requireActor("/account/security");

  if (!consumeRateLimit(`2fa:backup:${actor.id}`, AUTH_RATE_LIMITS.twoFactorByUser)) {
    return { ok: false, message: "Too many attempts. Wait a few minutes." };
  }

  const parsed = secondFactorCodeSchema.safeParse(code);
  if (!parsed.success) {
    return { ok: false, message: "Enter a current code or an unused backup code." };
  }

  const backupCodes = await regenerateBackupCodes(actor.id, parsed.data);
  if (!backupCodes) {
    return { ok: false, message: "That code is invalid or has already been used." };
  }

  refreshSecurity();
  return {
    ok: true,
    message: "New backup codes generated. Store them somewhere safe.",
    backupCodes,
  };
}

export async function sendPhoneCodeAction(phone: string): Promise<SecurityActionResult> {
  const actor = await requireActor("/account/security");

  if (!consumeRateLimit(`phone:send:${actor.id}`, AUTH_RATE_LIMITS.phoneCodeByUser)) {
    return { ok: false, message: "Too many codes requested. Try again later." };
  }

  const parsed = sendPhoneCodeSchema.safeParse({ phone });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid phone number with its country code." };
  }

  const { delivered } = await sendPhoneVerification(actor.id, parsed.data.phone);
  refreshSecurity();

  return {
    ok: delivered,
    message: delivered
      ? "Verification code sent. It expires in 10 minutes."
      : "SMS delivery is not configured for this environment.",
    phone: parsed.data.phone,
  };
}

export async function verifyPhoneCodeAction(code: string): Promise<SecurityActionResult> {
  const actor = await requireActor("/account/security");

  if (!consumeRateLimit(`phone:verify:${actor.id}`, AUTH_RATE_LIMITS.phoneVerifyByUser)) {
    return { ok: false, message: "Too many attempts. Wait a few minutes." };
  }

  const parsed = verifyPhoneCodeSchema.safeParse({ code });
  if (!parsed.success) {
    return { ok: false, message: "Enter the 6-digit verification code." };
  }

  if (!(await verifyPhoneVerification(actor.id, parsed.data.code))) {
    return { ok: false, message: "That code is invalid, expired, or has already been used." };
  }

  refreshSecurity();
  const status = await getSecurityStatus(actor.id);
  return { ok: true, message: "Phone number verified.", phone: status?.phone ?? undefined };
}
