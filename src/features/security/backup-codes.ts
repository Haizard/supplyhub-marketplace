import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;
const DEFAULT_COUNT = 10;

export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function generateBackupCodes(count = DEFAULT_COUNT): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Backup code count must be between 1 and 20.");
  }

  const codes = new Set<string>();

  while (codes.size < count) {
    const bytes = randomBytes(CODE_LENGTH);
    let code = "";

    for (const byte of bytes) {
      code += ALPHABET[byte % ALPHABET.length];
    }

    codes.add(code);
  }

  return [...codes];
}

export function hashBackupCode(code: string): string {
  return createHash("sha256")
    .update(`backup:${normalizeBackupCode(code)}`, "utf8")
    .digest("hex");
}
