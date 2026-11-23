import { createHash, randomInt } from "node:crypto";

export function generatePhoneCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashPhoneCode(code: string, phone: string): string {
  return createHash("sha256").update(`phone-verify:${phone}:${code}`, "utf8").digest("hex");
}
