import { describe, expect, it } from "vitest";

import {
  appendDecimal,
  appendDigit,
  applyBinary,
  applyUnary,
  formatCalculatorValue,
} from "@/features/pos/calculator";

describe("applyBinary", () => {
  it("does the four basic operations", () => {
    expect(applyBinary(2, "+", 3)).toBe(5);
    expect(applyBinary(9, "-", 4)).toBe(5);
    expect(applyBinary(6, "×", 7)).toBe(42);
    expect(applyBinary(9, "÷", 3)).toBe(3);
  });

  it("refuses division by zero", () => {
    expect(applyBinary(4, "÷", 0)).toBeNull();
  });

  it("supports powers and rejects non-finite results", () => {
    expect(applyBinary(2, "^", 10)).toBe(1024);
    expect(applyBinary(-1, "^", 0.5)).toBeNull();
  });
});

describe("applyUnary", () => {
  it("handles square roots, squares, and reciprocals", () => {
    expect(applyUnary(81, "sqrt")).toBe(9);
    expect(applyUnary(7, "square")).toBe(49);
    expect(applyUnary(4, "invert")).toBe(0.25);
  });

  it("refuses results outside the real numbers", () => {
    expect(applyUnary(-9, "sqrt")).toBeNull();
    expect(applyUnary(0, "invert")).toBeNull();
    expect(applyUnary(0, "log")).toBeNull();
  });

  it("computes percentages and factorials", () => {
    expect(applyUnary(250, "percent")).toBe(2.5);
    expect(applyUnary(5, "factorial")).toBe(120);
    expect(applyUnary(2.5, "factorial")).toBeNull();
  });

  it("uses radians for trigonometry", () => {
    expect(applyUnary(0, "sin")).toBe(0);
    expect(applyUnary(0, "cos")).toBe(1);
  });
});

describe("formatCalculatorValue", () => {
  it("trims floating point noise", () => {
    expect(formatCalculatorValue(0.1 + 0.2)).toBe("0.3");
    expect(formatCalculatorValue(7)).toBe("7");
    expect(formatCalculatorValue(0)).toBe("0");
  });

  it("switches to exponential form for very large or tiny values", () => {
    expect(formatCalculatorValue(1.5e15)).toContain("e");
    expect(formatCalculatorValue(1e-12)).toContain("e");
  });

  it("reports errors", () => {
    expect(formatCalculatorValue(Number.NaN)).toBe("Error");
  });
});

describe("display buffer helpers", () => {
  it("does not stack leading zeros", () => {
    expect(appendDigit("0", "5")).toBe("5");
    expect(appendDigit("12", "3")).toBe("123");
  });

  it("allows only one decimal point", () => {
    expect(appendDecimal("12")).toBe("12.");
    expect(appendDecimal("12.5")).toBe("12.5");
    expect(appendDecimal("")).toBe("0.");
  });

  it("starts over after an error", () => {
    expect(appendDigit("Error", "9")).toBe("9");
  });

  it("caps the buffer length", () => {
    expect(appendDigit("123456789012", "3")).toBe("123456789012");
  });
});
