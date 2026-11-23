"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useI18n } from "@/i18n/client";

import { dismissRecommendationAction, refreshBuyerRecommendationsAction } from "../actions";
import type { RecommendationView } from "../types";

export function RecommendationGrid({
  initialRecommendations,
}: {
  initialRecommendations: RecommendationView[];
}) {
  const { t, formatCurrency } = useI18n();
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await refreshBuyerRecommendationsAction("ACCOUNT");
      setMessage(result.ok ? t("insights.saved") : result.message);
    });
  }

  function dismiss(id: string) {
    startTransition(async () => {
      const result = await dismissRecommendationAction(id);
      setMessage(result.ok ? t("insights.saved") : result.message);

      if (result.ok) {
        setRecommendations((current) => current.filter((item) => item.id !== id));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("insights.recommendationsSubtitle")}</p>
        <Button type="button" size="sm" disabled={pending} onClick={refresh}>
          <Sparkles className="size-4" />
          {pending ? "…" : t("insights.refreshRecommendations")}
        </Button>
      </div>

      {message ? <Notice tone="info">{message}</Notice> : null}

      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-medium">{t("insights.noRecommendations")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("insights.noRecommendationsBody")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((item) => (
            <article
              key={item.id}
              className="flex flex-col rounded-xl border border-border bg-surface p-5"
            >
              <p className="text-xs font-medium text-accent">{item.reason}</p>
              <h2 className="mt-2 font-display text-lg font-medium tracking-[-0.02em]">
                {item.product.name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{item.product.studioName}</p>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                {item.product.summary}
              </p>
              <p className="mt-4 font-medium">
                {formatCurrency(item.product.priceCents, item.product.currency)}
              </p>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <Button asChild size="sm">
                  <Link href={`/products/${item.product.slug}`}>{t("insights.viewProduct")}</Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => dismiss(item.id)}
                >
                  {t("insights.dismiss")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
