import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const CODE_DIGITS = 6;
const PREVIOUS_STEPS = 1;

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(secret: string): Buffer {
  const normalized = secret.trim().toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      throw new Error("Invalid base32 secret.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function totpStepAt(timestamp: number): number {
  return Math.floor(timestamp / 1000 / STEP_SECONDS);
}

export function totpCodeForStep(secret: string, step: number): string {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;

  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, "0");
}

function codesMatch(candidate: string, expected: string): boolean {
  const actual = Buffer.from(candidate, "utf8");
  const target = Buffer.from(expected, "utf8");

  return actual.length === target.length && timingSafeEqual(actual, target);
}

/**
 * Returns the accepted time step, or null when the code is invalid or replayed.
 * `lastStep` prevents the same authenticator code from being used twice.
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  options: { now?: number; lastStep?: number | null } = {},
): number | null {
  if (!/^\d{6}$/.test(code)) {
    return null;
  }

  const current = totpStepAt(options.now ?? Date.now());
  const floor = Math.max(0, current - PREVIOUS_STEPS);

  for (let step = current; step >= floor; step -= 1) {
    if (options.lastStep != null && step <= options.lastStep) {
      continue;
    }

    if (codesMatch(code, totpCodeForStep(secret, step))) {
      return step;
    }
  }

  return null;
}
