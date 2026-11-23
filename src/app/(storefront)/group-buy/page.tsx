import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listActiveCampaigns } from "@/features/groupbuy/queries";

export const metadata: Metadata = {
  title: "Group buying",
  description: "Join group buying campaigns for progressive discounts.",
};

export default function GroupBuyPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <GroupBuyContent />
    </Suspense>
  );
}

async function GroupBuyContent() {
  const enabled = await isFeatureEnabled("phase7.groupBuying");

  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight">Group buying</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join forces with other buyers for progressive discounts.
          </p>
        </header>
        <EmptyState
          title="Coming soon"
          description="Group buying campaigns are not available yet. Check back later for exclusive community deals."
        />
      </PageShell>
    );
  }

  const campaigns = await listActiveCampaigns();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Group buying</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join forces with other buyers for progressive discounts.
        </p>
      </header>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No active campaigns"
          description="There are no group buying campaigns running right now. Check back soon."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    <Link href={`/group-buy/${campaign.id}`} className="hover:underline">
                      {campaign.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{campaign.vendorName}</p>
                </div>
                <p className="text-sm font-medium">
                  {campaign.currentTierPrice} {campaign.currency}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {campaign.totalQuantity} / {campaign.targetQuantity} joined
                  </span>
                  <span>{campaign.progressPercentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${campaign.progressPercentage}%` }}
                  />
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>Base price</dt>
                  <dd className="mt-0.5 text-sm text-foreground">
                    {campaign.basePrice} {campaign.currency}
                  </dd>
                </div>
                <div>
                  <dt>Current price</dt>
                  <dd className="mt-0.5 text-sm text-foreground">
                    {campaign.currentTierPrice} {campaign.currency}
                  </dd>
                </div>
                <div>
                  <dt>Participants</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{campaign.participantCount}</dd>
                </div>
              </dl>

              <Link
                href={`/group-buy/${campaign.id}`}
                className="inline-block text-sm text-accent hover:underline"
              >
                View and join →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
