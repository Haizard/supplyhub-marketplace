"use client";

import { useState, useTransition } from "react";
import { Check, Gift } from "lucide-react";

import { useT } from "@/i18n/client";

import { redeemLoyaltyRewardAction } from "../actions";

export function RedeemButton({ pointsBalance, cost }: { pointsBalance: number; cost: number }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const canRedeem = pointsBalance >= cost;

  function redeem() {
    startTransition(async () => {
      setError("");
      const result = await redeemLoyaltyRewardAction().catch(() => ({
        ok: false as const,
        error: t("loyalty.error"),
      }));
      if (result.ok) setCode(result.code);
      else setError(result.error || t("loyalty.error"));
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={redeem}
        disabled={!canRedeem || pending}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Gift className="size-4" aria-hidden="true" />
        {pending ? t("common.processing") : t("loyalty.redeem", { cost })}
      </button>
      {code ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-[#0f766e]/30 bg-[#0f766e]/5 px-3 py-2 text-sm font-medium text-[#0f766e]">
          <Check className="size-4" aria-hidden="true" />
          {t("loyalty.redeemSuccess", { code })}
        </p>
      ) : null}
      {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
      {!canRedeem ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("loyalty.needMore", { remaining: cost - pointsBalance })}
        </p>
      ) : null}
    </div>
  );
}
