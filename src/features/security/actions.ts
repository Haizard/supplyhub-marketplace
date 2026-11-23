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
  startTwoFactorSetup,
} from "./service";
import { secondFactorCodeSchema } from "./validation";

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

/**
 * Phone verification is intentionally deferred until an SMS provider is chosen.
 * The schema and service remain in place, but no code is sent or consumed.
 */
export async function sendPhoneCodeAction(phone: string): Promise<SecurityActionResult> {
  await requireActor("/account/security");
  void phone;
  return { ok: false, message: "Phone verification is not enabled yet." };
}

export async function verifyPhoneCodeAction(code: string): Promise<SecurityActionResult> {
  await requireActor("/account/security");
  void code;
  return { ok: false, message: "Phone verification is not enabled yet." };
}
