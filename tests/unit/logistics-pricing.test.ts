import { describe, expect, it } from "vitest";

import { calculateDeliveryFee, type DecimalLike } from "@/features/logistics/pricing";
import { codesMatch, generateHandoverCode, isHandoverExpired } from "@/features/logistics/otp";

const dec = (value: string): DecimalLike => ({ toString: () => value });

describe("delivery pricing", () => {
  const rule = {
    currency: "TZS",
    baseFee: dec("5000"),
    perKmRate: dec("2000"),
    minimumFee: dec("5000"),
    maximumFee: dec("50000"),
  };

  it("applies a base fee plus distance rate", () => {
    expect(calculateDeliveryFee(rule, 3)).toEqual({ fee: "11000.00", currency: "TZS" });
  });

  it("enforces the minimum fee", () => {
    expect(calculateDeliveryFee(rule, 0).fee).toBe("5000.00");
  });

  it("enforces the maximum fee", () => {
    expect(calculateDeliveryFee(rule, 100).fee).toBe("50000.00");
  });

  it("rejects negative distances", () => {
    expect(() => calculateDeliveryFee(rule, -1)).toThrow();
  });
});

describe("hand-over codes", () => {
  it("generates six digit codes", () => {
    const code = generateHandoverCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("compares codes exactly after trimming", () => {
    expect(codesMatch("123456", " 123456 ")).toBe(true);
    expect(codesMatch("123456", "12345")).toBe(false);
    expect(codesMatch(null, "123456")).toBe(false);
    expect(codesMatch("123456", "abc123")).toBe(false);
  });

  it("detects expiry", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(isHandoverExpired(null, now)).toBe(true);
    expect(isHandoverExpired(new Date("2026-01-01T11:00:00Z"), now)).toBe(true);
    expect(isHandoverExpired(new Date("2026-01-01T13:00:00Z"), now)).toBe(false);
  });
});
