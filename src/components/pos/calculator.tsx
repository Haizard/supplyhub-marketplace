"use client";

import { X } from "lucide-react";
import { useState } from "react";

import {
  appendDecimal,
  appendDigit,
  applyBinary,
  applyUnary,
  formatCalculatorValue,
  type BinaryOp,
  type UnaryOp,
} from "@/features/pos/calculator";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

type Mode = "basic" | "scientific";

const scientificRow: Array<{ label: string; op: UnaryOp | BinaryOp | "pi" }> = [
  { label: "sin", op: "sin" },
  { label: "cos", op: "cos" },
  { label: "tan", op: "tan" },
  { label: "√", op: "sqrt" },
  { label: "x²", op: "square" },
  { label: "1/x", op: "invert" },
  { label: "π", op: "pi" },
  { label: "xʸ", op: "^" },
  { label: "log", op: "log" },
  { label: "ln", op: "ln" },
  { label: "n!", op: "factorial" },
  { label: "%", op: "percent" },
];

export function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("basic");
  const [display, setDisplay] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pending, setPending] = useState<BinaryOp | null>(null);
  const [freshEntry, setFreshEntry] = useState(false);

  const current = Number.parseFloat(display) || 0;

  function commit(value: number | null) {
    setDisplay(value === null ? "Error" : formatCalculatorValue(value));
    setFreshEntry(true);
  }

  function pressDigit(digit: string) {
    setDisplay((previous) => (freshEntry ? digit : appendDigit(previous, digit)));
    setFreshEntry(false);
  }

  function pressDecimal() {
    setDisplay((previous) => (freshEntry ? "0." : appendDecimal(previous)));
    setFreshEntry(false);
  }

  function chooseOp(op: BinaryOp) {
    if (pending !== null && accumulator !== null && !freshEntry) {
      const result = applyBinary(accumulator, pending, current);
      if (result === null) {
        commit(null);
        setPending(null);
        setAccumulator(null);
        return;
      }
      setAccumulator(result);
      setDisplay(formatCalculatorValue(result));
    } else {
      setAccumulator(current);
    }

    setPending(op);
    setFreshEntry(true);
  }

  function equals() {
    if (pending === null || accumulator === null) return;
    commit(applyBinary(accumulator, pending, current));
    setPending(null);
    setAccumulator(null);
  }

  function runUnary(op: UnaryOp) {
    commit(applyUnary(current, op));
    setPending(null);
    setAccumulator(null);
  }

  function clearAll() {
    setDisplay("0");
    setAccumulator(null);
    setPending(null);
    setFreshEntry(false);
  }

  function backspace() {
    setDisplay((previous) =>
      previous === "Error" || previous.length <= 1
        ? "0"
        : previous.slice(0, -1).replace(/-$/, "") || "0",
    );
    setFreshEntry(false);
  }

  const keypad: Array<{
    label: string;
    onClick: () => void;
    tone?: "operator" | "equals" | "muted";
  }> = [
    { label: "C", onClick: clearAll, tone: "muted" },
    { label: "⌫", onClick: backspace, tone: "muted" },
    { label: "%", onClick: () => runUnary("percent"), tone: "muted" },
    { label: "÷", onClick: () => chooseOp("÷"), tone: "operator" },
    { label: "7", onClick: () => pressDigit("7") },
    { label: "8", onClick: () => pressDigit("8") },
    { label: "9", onClick: () => pressDigit("9") },
    { label: "×", onClick: () => chooseOp("×"), tone: "operator" },
    { label: "4", onClick: () => pressDigit("4") },
    { label: "5", onClick: () => pressDigit("5") },
    { label: "6", onClick: () => pressDigit("6") },
    { label: "−", onClick: () => chooseOp("-"), tone: "operator" },
    { label: "1", onClick: () => pressDigit("1") },
    { label: "2", onClick: () => pressDigit("2") },
    { label: "3", onClick: () => pressDigit("3") },
    { label: "+", onClick: () => chooseOp("+"), tone: "operator" },
    { label: "±", onClick: () => runUnary("negate") },
    { label: "0", onClick: () => pressDigit("0") },
    { label: ".", onClick: pressDecimal },
    { label: "=", onClick: equals, tone: "equals" },
  ];

  return (
    <div
      role="dialog"
      aria-label={t("pos.calculator")}
      className="fixed right-4 bottom-20 z-40 w-[19rem] max-w-[calc(100vw-2rem)] rounded-3xl bg-[#11131d] p-3 text-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.75)] lg:bottom-4"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#e8f0bd] uppercase">
          {t("pos.calculator")}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-white/10 p-0.5 text-[10px]">
            {(["basic", "scientific"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                className={cn(
                  "rounded-full px-2 py-1 transition-colors",
                  mode === option ? "bg-[#e8f0bd] text-[#11131d]" : "text-white/70",
                )}
              >
                {option === "basic" ? t("pos.basic") : t("pos.scientific")}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("pos.closeCalculator")}
            className="rounded-full p-1 text-white/60 transition-colors hover:text-white"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="mt-2 truncate rounded-2xl bg-black/40 px-3 py-3 text-right font-mono text-2xl tabular-nums">
        {display}
      </p>

      {mode === "scientific" ? (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {scientificRow.map((key) => (
            <button
              key={key.label}
              type="button"
              onClick={() => {
                if (key.op === "pi") {
                  commit(Math.PI);
                } else if (key.op === "^") {
                  chooseOp("^");
                } else if (
                  [
                    "sin",
                    "cos",
                    "tan",
                    "sqrt",
                    "square",
                    "invert",
                    "log",
                    "ln",
                    "factorial",
                    "percent",
                  ].includes(key.op)
                ) {
                  runUnary(key.op as UnaryOp);
                }
              }}
              className="rounded-xl bg-white/10 py-2 text-[11px] font-medium text-[#cfd6f7] transition-colors hover:bg-white/20"
            >
              {key.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {keypad.map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={key.onClick}
            className={cn(
              "rounded-xl py-2.5 text-sm font-medium transition-colors",
              key.tone === "operator" && "bg-white/10 text-[#e8f0bd] hover:bg-white/20",
              key.tone === "muted" && "bg-white/5 text-white/70 hover:bg-white/15",
              key.tone === "equals" && "bg-[#e8f0bd] text-[#11131d] hover:bg-[#f2f7cf]",
              !key.tone && "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            {key.label}
          </button>
        ))}
      </div>

      <p className="mt-2 px-1 text-[10px] leading-4 text-white/40">{t("pos.calculatorHint")}</p>
    </div>
  );
}
