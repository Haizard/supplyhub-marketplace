"use client";

import { useState, useTransition } from "react";
import { Check, CreditCard } from "lucide-react";

import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

import {
  cancelSubscriptionAction,
  choosePlanAction,
  paySubscriptionInvoiceAction,
} from "../actions";
import type { SubscriptionPlanView } from "../types";

export function PlanCard({
  plan,
  businessId,
  current,
}: {
  plan: SubscriptionPlanView;
  businessId: string;
  current: boolean;
}) {
  const t = useT();
  const [seats, setSeats] = useState(Math.max(1, plan.includedSeats));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function choose() {
    startTransition(async () => {
      setMessage("");
      const result = await choosePlanAction({
        businessId,
        planId: plan.id,
        seats,
      }).catch(() => ({ ok: false as const, error: t("subscriptions.error") }));
      setMessage(result.ok ? result.message : result.error);
    });
  }

  return (
    <li
      className={cn(
        "flex flex-col rounded-xl border bg-surface p-4",
        current ? "border-[#0f766e]/50 ring-1 ring-[#0f766e]/20" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-medium">{plan.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{plan.code}</p>
        </div>
        {current ? (
          <span className="rounded-full bg-[#0f766e]/10 px-2 py-1 text-[0.625rem] font-semibold text-[#0f766e]">
            {t("subscriptions.current")}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-semibold text-[#0f766e]">
        {Number(plan.priceMonthly).toLocaleString()} {plan.currency}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          / {t("subscriptions.perSeat")}
        </span>
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{plan.description}</p>
      {plan.features.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-1.5 text-xs">
              <Check className="size-3.5 text-[#0f766e]" aria-hidden="true" /> {feature}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto flex items-end gap-2 pt-4">
        <label className="flex-1">
          <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {t("subscriptions.seats")}
          </span>
          <input
            type="number"
            min={1}
            max={plan.seatLimit}
            value={seats}
            onChange={(event) => setSeats(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={choose}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90 disabled:opacity-40"
        >
          {t("subscriptions.choose")}
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-[#0f766e]">{message}</p> : null}
    </li>
  );
}

export function CancelSubscriptionButton({ businessId }: { businessId: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage("");
            const result = await cancelSubscriptionAction(businessId).catch(() => ({
              ok: false as const,
              error: t("subscriptions.error"),
            }));
            setMessage(result.ok ? result.message : result.error);
          })
        }
        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-40"
      >
        {t("subscriptions.cancel")}
      </button>
      {message ? <p className="mt-1 text-xs text-[#0f766e]">{message}</p> : null}
    </div>
  );
}

export function PayInvoiceButton({
  businessId,
  invoiceId,
}: {
  businessId: string;
  invoiceId: string;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage("");
            const result = await paySubscriptionInvoiceAction({ businessId, invoiceId }).catch(
              () => ({ ok: false as const, error: t("subscriptions.error") }),
            );
            setMessage(result.ok ? result.message : result.error);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f766e]/30 bg-[#0f766e]/5 px-3 py-1.5 text-xs font-semibold text-[#0f766e] transition hover:bg-[#0f766e]/10 disabled:opacity-40"
      >
        <CreditCard className="size-3.5" aria-hidden="true" /> {t("subscriptions.pay")}
      </button>
      {message ? <p className="mt-1 text-xs text-[#0f766e]">{message}</p> : null}
    </div>
  );
}
