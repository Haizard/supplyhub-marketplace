import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageShell } from "@/components/storefront/page-shell";
import { getBusinessById } from "@/features/business/queries";
import { InsightsPanel } from "@/features/insights/components/insights-panel";
import { getLatestBusinessInsights } from "@/features/insights/service";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";
import {
  BusinessAccessError,
  hasPermission,
  resolveBusinessContext,
} from "@/server/business/context";

export const metadata: Metadata = {
  title: "Business insights",
  description: "Rule-based signals generated from your business data.",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BusinessInsightsPage({ params }: Props) {
  const { id } = await params;
  const actor = await requireActor(`/business/${id}/insights`);
  const [business, { t }] = await Promise.all([getBusinessById(id), getServerI18n()]);

  if (!business) {
    notFound();
  }

  let context;
  try {
    context = await resolveBusinessContext(actor, id);
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      notFound();
    }
    throw error;
  }

  if (!hasPermission(context, "insights.read")) {
    redirect(`/business/${id}?denied=insights`);
  }

  const insights = await getLatestBusinessInsights(id);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="max-w-3xl border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">{t("insights.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          {business.name}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("insights.title")}
        </p>
      </div>

      <div className="mt-10">
        <InsightsPanel businessId={id} initialInsights={insights} />
      </div>
    </PageShell>
  );
}
