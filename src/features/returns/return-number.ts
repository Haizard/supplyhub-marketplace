import { randomBytes } from "node:crypto";

export const RETURN_NUMBER_PATTERN = /^RT-\d{8}-[2-9A-HJ-NP-Z]{6}$/;

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function createReturnNumber(now = new Date()): string {
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");

  let code = "";

  for (const byte of randomBytes(6)) {
    code += ALPHABET[byte % ALPHABET.length];
  }

  return `RT-${date}-${code}`;
}
