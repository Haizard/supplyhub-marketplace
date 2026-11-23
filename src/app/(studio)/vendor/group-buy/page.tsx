import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GroupBuyStatusActions } from "@/components/vendor/group-buy-status-actions";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listVendorCampaigns } from "@/features/groupbuy/queries";
import { CAMPAIGN_STATUS_LABELS } from "@/features/groupbuy/status";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Group buying campaigns",
  robots: { index: false, follow: false },
};

export default function VendorGroupBuyPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <VendorGroupBuyContent />
    </Suspense>
  );
}

async function VendorGroupBuyContent() {
  const access = await requireStudioAccess("groupbuy.manage", "/vendor/group-buy");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.groupBuying");

  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight">{t("groupBuy.title")}</h1>
        </header>
        <EmptyState title="Coming soon" description={t("groupBuy.comingSoon")} />
      </PageShell>
    );
  }

  const campaigns = await listVendorCampaigns(access.vendorId);

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("groupBuy.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("groupBuy.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/vendor/services"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm hover:bg-surface-muted"
          >
            {t("services.title")}
          </Link>
          <Link
            href="/vendor/group-buy/new"
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            {t("groupBuy.newCampaign")}
          </Link>
        </div>
      </header>

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description={t("groupBuy.empty")} />
      ) : (
        <ul className="space-y-3">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {campaign.campaignNumber}
                  </p>
                  <p className="font-medium">{campaign.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.totalQuantity} / {campaign.targetQuantity} ·{" "}
                    {campaign.currentTierPrice} {campaign.currency}
                  </p>
                </div>
                <Badge tone={campaign.status === "ACTIVE" ? "success" : "neutral"}>
                  {CAMPAIGN_STATUS_LABELS[campaign.status]}
                </Badge>
              </div>
              <GroupBuyStatusActions campaignId={campaign.id} status={campaign.status} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
