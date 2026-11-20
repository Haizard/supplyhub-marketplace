import { randomInt } from "node:crypto";

/** Hand-over codes are six digits, shown to the buyer, entered by the agent. */
export function generateHandoverCode(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * OTP lifetime. Configurable default; the roadmap leaves exact hand-over
 * policy unresolved.
 */
export const HANDOVER_CODE_TTL_MINUTES = 60;

export function handoverExpiry(now = new Date()): Date {
  return new Date(now.getTime() + HANDOVER_CODE_TTL_MINUTES * 60_000);
}

export function isHandoverExpired(expiresAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

export function codesMatch(expected: string | null, supplied: string): boolean {
  if (!expected) return false;
  const a = expected.trim();
  const b = supplied.trim();
  if (!/^\d{4,8}$/.test(b)) return false;
  return a === b;
}
