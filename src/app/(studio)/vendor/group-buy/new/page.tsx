import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GroupBuyCampaignForm } from "@/components/vendor/group-buy-campaign-form";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "New group buy campaign",
  robots: { index: false, follow: false },
};

export default function NewGroupBuyPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <NewGroupBuyContent />
    </Suspense>
  );
}

async function NewGroupBuyContent() {
  const access = await requireStudioAccess("groupbuy.manage", "/vendor/group-buy/new");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.groupBuying");

  return (
    <PageShell className="space-y-6 py-8">
      <Link
        href="/vendor/group-buy"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {t("groupBuy.title")}
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("groupBuy.newCampaign")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Campaigns start as drafts and go live when you activate them.
        </p>
      </header>

      {enabled ? (
        <div className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <GroupBuyCampaignForm vendorId={access.vendorId} />
        </div>
      ) : (
        <EmptyState title="Coming soon" description={t("groupBuy.comingSoon")} />
      )}
    </PageShell>
  );
}
