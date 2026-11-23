"use client";

import { useState, useTransition } from "react";
import { Check, Save } from "lucide-react";

import { useT } from "@/i18n/client";

import { saveCustomerAction } from "../actions";
import type { StudioCustomerView } from "../types";

export function CustomerCard({ customer }: { customer: StudioCustomerView }) {
  const t = useT();
  const [note, setNote] = useState(customer.note);
  const [segment, setSegment] = useState(customer.segment);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function save() {
    if (!customer.recordId) return;
    startTransition(async () => {
      setMessage("");
      const result = await saveCustomerAction({
        customerId: customer.recordId!,
        note,
        segment,
      }).catch(() => ({ ok: false as const, error: t("crm.error") }));
      setMessage(result.ok ? t("crm.saved") : result.error || t("crm.error"));
    });
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{customer.name}</p>
          <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
        </div>
        <span className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-2.5 py-1 text-[0.6875rem] font-semibold text-[#0f766e]">
          {t(`crm.segment.${segment}`)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("crm.orders")}</dt>
          <dd className="mt-0.5 font-semibold">{customer.orderCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("crm.spend")}</dt>
          <dd className="mt-0.5 font-semibold">
            {Math.round(customer.totalSpend).toLocaleString()} TZS
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("crm.lastOrder")}</dt>
          <dd className="mt-0.5 font-semibold">
            {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {t("crm.note")}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("crm.notePlaceholder")}
            rows={2}
            maxLength={1000}
            disabled={!customer.recordId}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-[#0f766e] focus:outline-none disabled:opacity-60"
          />
        </label>
        <div className="flex gap-2">
          <select
            value={segment}
            onChange={(event) => setSegment(event.target.value as StudioCustomerView["segment"])}
            disabled={!customer.recordId}
            className="rounded-lg border border-border bg-surface px-2 py-2 text-sm disabled:opacity-60"
            aria-label={t("crm.segmentLabel")}
          >
            {(["NEW", "RETURNING", "VIP"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`crm.segment.${value}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={!customer.recordId || pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90 disabled:opacity-40"
          >
            <Save className="size-4" aria-hidden="true" /> {t("crm.save")}
          </button>
        </div>
      </div>
      {message ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-[#0f766e]">
          <Check className="size-3.5" aria-hidden="true" /> {message}
        </p>
      ) : null}
    </li>
  );
}
