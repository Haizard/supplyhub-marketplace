import { describe, expect, it } from "vitest";

import {
  generateBackupCodes,
  hashBackupCode,
  normalizeBackupCode,
} from "@/features/security/backup-codes";
import { generatePhoneCode, hashPhoneCode } from "@/features/security/phone-code";
import {
  decodeBase32,
  totpCodeForStep,
  totpStepAt,
  verifyTotpCode,
} from "@/features/security/totp";

const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
  it("decodes the RFC 6238 test secret", () => {
    expect(decodeBase32(RFC_SECRET).toString("utf8")).toBe("12345678901234567890");
  });

  it("matches the published 6-digit RFC 6238 vectors", () => {
    expect(totpStepAt(59_000)).toBe(1);
    expect(totpCodeForStep(RFC_SECRET, 1)).toBe("287082");
    expect(totpCodeForStep(RFC_SECRET, totpStepAt(1_111_111_109_000))).toBe("081804");
    expect(totpCodeForStep(RFC_SECRET, totpStepAt(1_111_111_111_000))).toBe("050471");
  });

  it("accepts the current and previous step but rejects replay", () => {
    const now = 180_000;
    const step = totpStepAt(now);
    const code = totpCodeForStep(RFC_SECRET, step);

    expect(verifyTotpCode(RFC_SECRET, code, { now })).toBe(step);
    expect(verifyTotpCode(RFC_SECRET, code, { now, lastStep: step })).toBeNull();

    const previous = totpCodeForStep(RFC_SECRET, step - 1);
    expect(verifyTotpCode(RFC_SECRET, previous, { now })).toBe(step - 1);
  });

  it("rejects malformed codes", () => {
    expect(verifyTotpCode(RFC_SECRET, "12345")).toBeNull();
    expect(verifyTotpCode(RFC_SECRET, "abcdef")).toBeNull();
  });
});

describe("backup codes", () => {
  it("generates unique codes and normalizes input", () => {
    const codes = generateBackupCodes(10);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-HJ-NP-Z2-9]{10}$/.test(code))).toBe(true);
    expect(normalizeBackupCode(` ${codes[0]!.slice(0, 5)}-${codes[0]!.slice(5)} `)).toBe(codes[0]);
  });

  it("hashes codes deterministically without storing the plain value", () => {
    const code = generateBackupCodes(1)[0]!;

    expect(hashBackupCode(code)).toBe(hashBackupCode(normalizeBackupCode(code)));
    expect(hashBackupCode(code)).not.toBe(code);
    expect(hashBackupCode(code)).not.toBe(hashBackupCode("ABCDEFGHJK"));
  });
});

describe("phone verification codes", () => {
  it("creates a six-digit code", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(generatePhoneCode()).toMatch(/^\d{6}$/);
    }
  });

  it("binds the hash to both code and phone number", () => {
    const code = "123456";

    expect(hashPhoneCode(code, "+255700000001")).toBe(hashPhoneCode(code, "+255700000001"));
    expect(hashPhoneCode(code, "+255700000001")).not.toBe(hashPhoneCode(code, "+255700000002"));
    expect(hashPhoneCode(code, "+255700000001")).not.toBe(hashPhoneCode("654321", "+255700000001"));
  });
});
