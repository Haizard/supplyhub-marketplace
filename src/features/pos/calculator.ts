/**
 * Pure calculator arithmetic for the counter calculator. No `eval`, no global
 * state — the component owns the keypad, this module owns the maths.
 */

export type BinaryOp = "+" | "-" | "×" | "÷" | "^";

export type UnaryOp =
  | "sqrt"
  | "square"
  | "invert"
  | "sin"
  | "cos"
  | "tan"
  | "log"
  | "ln"
  | "percent"
  | "negate"
  | "factorial";

export function applyBinary(left: number, op: BinaryOp, right: number): number | null {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;

  let result: number;

  switch (op) {
    case "+":
      result = left + right;
      break;
    case "-":
      result = left - right;
      break;
    case "×":
      result = left * right;
      break;
    case "÷":
      if (right === 0) return null;
      result = left / right;
      break;
    case "^":
      result = left ** right;
      break;
  }

  return Number.isFinite(result) ? result : null;
}

export function applyUnary(value: number, op: UnaryOp): number | null {
  if (!Number.isFinite(value)) return null;

  let result: number;

  switch (op) {
    case "sqrt":
      if (value < 0) return null;
      result = Math.sqrt(value);
      break;
    case "square":
      result = value * value;
      break;
    case "invert":
      if (value === 0) return null;
      result = 1 / value;
      break;
    case "sin":
      result = Math.sin(value);
      break;
    case "cos":
      result = Math.cos(value);
      break;
    case "tan":
      result = Math.tan(value);
      break;
    case "log":
      if (value <= 0) return null;
      result = Math.log10(value);
      break;
    case "ln":
      if (value <= 0) return null;
      result = Math.log(value);
      break;
    case "percent":
      result = value / 100;
      break;
    case "negate":
      result = -value;
      break;
    case "factorial": {
      if (!Number.isInteger(value) || value < 0 || value > 170) return null;
      result = 1;
      for (let i = 2; i <= value; i += 1) result *= i;
      break;
    }
  }

  return Number.isFinite(result) ? result : null;
}

/** Formats a result for the calculator display without float noise. */
export function formatCalculatorValue(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  if (value === 0) return "0";

  const magnitude = Math.abs(value);

  if (magnitude >= 1e12 || magnitude < 1e-9) {
    return value.toExponential(6).replace(/\.?0+e/, "e");
  }

  return String(Number(value.toPrecision(12)));
}

/** Joins a digit into the current display buffer, keeping it usable. */
export function appendDigit(display: string, digit: string): string {
  if (display === "Error") display = "";
  if (display === "0") return digit;
  if (display.replace("-", "").replace(".", "").length >= 12) return display;
  return `${display}${digit}`;
}

export function appendDecimal(display: string): string {
  if (display === "Error" || display === "") return "0.";
  if (display.includes(".")) return display;
  return `${display}.`;
}
