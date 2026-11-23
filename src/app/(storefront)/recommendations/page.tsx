import type { Metadata } from "next";

import { PageShell } from "@/components/storefront/page-shell";
import { RecommendationGrid } from "@/features/insights/components/recommendation-grid";
import { ensureBuyerRecommendations } from "@/features/insights/service";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Picked for you",
  description: "Product suggestions based on your orders and saved products.",
  robots: { index: false, follow: false },
};

export default async function RecommendationsPage() {
  const actor = await requireActor("/recommendations");
  const [recommendations, { t }] = await Promise.all([
    ensureBuyerRecommendations(actor.id, "ACCOUNT"),
    getServerI18n(),
  ]);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="max-w-3xl border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">{t("insights.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          {t("insights.recommendationsTitle")}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("insights.recommendationsSubtitle")}
        </p>
      </div>

      <div className="mt-10">
        <RecommendationGrid initialRecommendations={recommendations} />
      </div>
    </PageShell>
  );
}
