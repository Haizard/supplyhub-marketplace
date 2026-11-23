"use client";

import { useState, useTransition } from "react";

import { useT } from "@/i18n/client";

import { saveSubscriptionPlanAction } from "../actions";
import type { SubscriptionPlanView } from "../types";

const input =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-[#0f766e] focus:outline-none";
const label =
  "block text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase";

export function PlanForm({ plan }: { plan?: SubscriptionPlanView }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    planId: plan?.id ?? "",
    code: plan?.code ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    priceMonthly: plan?.priceMonthly ?? "15000",
    currency: plan?.currency ?? "TZS",
    includedSeats: String(plan?.includedSeats ?? 3),
    seatLimit: String(plan?.seatLimit ?? 25),
    features: plan?.features.join("\n") ?? "",
    status: plan?.status ?? "DRAFT",
    sortOrder: String(plan?.sortOrder ?? 0),
  });

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const result = await saveSubscriptionPlanAction({
        planId: form.planId,
        code: form.code,
        name: form.name,
        description: form.description,
        priceMonthly: Number(form.priceMonthly),
        currency: form.currency,
        includedSeats: Number(form.includedSeats),
        seatLimit: Number(form.seatLimit),
        features: form.features
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        status: form.status as "DRAFT" | "ACTIVE" | "ARCHIVED",
        sortOrder: Number(form.sortOrder),
      }).catch(() => ({ ok: false as const, error: t("subscriptions.error") }));
      setMessage(result.ok ? result.message : result.error);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2"
    >
      <label className={label}>
        {t("subscriptions.planCode")}
        <input
          className={input}
          value={form.code}
          onChange={(event) => update("code", event.target.value)}
          required
        />
      </label>
      <label className={label}>
        {t("subscriptions.planName")}
        <input
          className={input}
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          required
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        {t("subscriptions.planDescription")}
        <input
          className={input}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </label>
      <label className={label}>
        {t("subscriptions.monthlyPrice")}
        <input
          className={input}
          type="number"
          min="0"
          step="0.01"
          value={form.priceMonthly}
          onChange={(event) => update("priceMonthly", event.target.value)}
          required
        />
      </label>
      <label className={label}>
        {t("subscriptions.currency")}
        <input
          className={input}
          value={form.currency}
          onChange={(event) => update("currency", event.target.value.toUpperCase())}
          maxLength={3}
          required
        />
      </label>
      <label className={label}>
        {t("subscriptions.includedSeats")}
        <input
          className={input}
          type="number"
          min="1"
          value={form.includedSeats}
          onChange={(event) => update("includedSeats", event.target.value)}
        />
      </label>
      <label className={label}>
        {t("subscriptions.seatLimit")}
        <input
          className={input}
          type="number"
          min="1"
          value={form.seatLimit}
          onChange={(event) => update("seatLimit", event.target.value)}
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        {t("subscriptions.features")}
        <textarea
          className={input}
          rows={3}
          value={form.features}
          onChange={(event) => update("features", event.target.value)}
          placeholder="Unlimited RFQs\nPriority support"
        />
      </label>
      <label className={label}>
        {t("subscriptions.formStatus")}
        <select
          className={input}
          value={form.status}
          onChange={(event) => update("status", event.target.value)}
        >
          {(["DRAFT", "ACTIVE", "ARCHIVED"] as const).map((status) => (
            <option key={status} value={status}>
              {t(`subscriptions.planStatus.${status}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("subscriptions.sortOrder")}
        <input
          className={input}
          type="number"
          min="0"
          value={form.sortOrder}
          onChange={(event) => update("sortOrder", event.target.value)}
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90 disabled:opacity-40"
        >
          {plan ? t("subscriptions.savePlan") : t("subscriptions.createPlan")}
        </button>
        {message ? <p className="mt-2 text-xs text-[#0f766e]">{message}</p> : null}
      </div>
    </form>
  );
}
