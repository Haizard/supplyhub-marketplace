"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useI18n } from "@/i18n/client";

import { refreshBusinessInsightsAction } from "../actions";
import type { BusinessInsightView } from "../types";

const toneFor = (severity: BusinessInsightView["severity"]) =>
  severity === "WARNING" ? "danger" : severity === "OPPORTUNITY" ? "success" : "neutral";

export function InsightsPanel({
  businessId,
  initialInsights,
}: {
  businessId: string;
  initialInsights: BusinessInsightView[];
}) {
  const { t, locale, formatDate } = useI18n();
  const [insights, setInsights] = useState(initialInsights);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await refreshBusinessInsightsAction({ businessId });
      setMessage(result.ok ? t("insights.saved") : result.message);

      if (result.ok) {
        setInsights((current) => [...current]);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("insights.businessSubtitle")}</p>
        <Button type="button" size="sm" disabled={pending} onClick={refresh}>
          <Sparkles className="size-4" />
          {pending ? "…" : t("insights.refresh")}
        </Button>
      </div>

      {message ? <Notice tone="info">{message}</Notice> : null}

      {insights.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-medium">{t("insights.noInsights")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("insights.noInsightsBody")}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {insights.map((insight) => (
            <article
              key={insight.id}
              className="flex flex-col rounded-xl border border-border bg-surface p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">
                  {insight.title}
                </h2>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${toneFor(insight.severity) === "danger" ? "border-danger/25 bg-danger/10 text-danger" : toneFor(insight.severity) === "success" ? "border-success/25 bg-success/10 text-success" : "border-border bg-surface-muted text-muted-foreground"}`}
                >
                  {t(`insights.severity.${insight.severity}`)}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">{insight.summary}</p>
              <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm">
                {insight.recommendation}
              </p>

              <p className="mt-auto pt-5 text-xs text-muted-foreground">
                {t("insights.confidence", { percent: insight.confidence })} ·{" "}
                {t("insights.generated", {
                  date: formatDate(insight.generatedAt, { dateStyle: "medium" }),
                })}{" "}
                · {locale}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
