import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageShell } from "@/components/storefront/page-shell";
import { JoinForm } from "@/components/storefront/group-buy-join-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { getCampaign, getCampaignProgress } from "@/features/groupbuy/queries";
import { CAMPAIGN_STATUS_LABELS } from "@/features/groupbuy/status";
import { getSessionActor } from "@/server/auth/session";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Group buying campaign",
  robots: { index: false, follow: true },
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CampaignDetailContent params={params} />
    </Suspense>
  );
}

async function CampaignDetailContent({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  if (!uuidSchema.safeParse(campaignId).success) {
    notFound();
  }

  const enabled = await isFeatureEnabled("phase7.groupBuying");
  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <Link href="/group-buy" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to group buying
        </Link>
        <EmptyState
          title="Coming soon"
          description="Group buying campaigns are not available yet."
        />
      </PageShell>
    );
  }

  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    notFound();
  }

  const progress = getCampaignProgress({
    targetQuantity: campaign.targetQuantity,
    basePrice: campaign.basePrice,
    tiers: campaign.tiers,
    participations: campaign.participations,
    status: campaign.status,
  });

  const actor = await getSessionActor();
  const hasJoined = actor ? campaign.participations.some((p) => p.buyerId === actor.id) : false;

  const isActive = campaign.status === "ACTIVE";

  return (
    <PageShell className="space-y-6 py-8">
      <Link href="/group-buy" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to group buying
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl tracking-tight">{campaign.title}</h1>
            <Badge tone={isActive ? "success" : "neutral"}>
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign.vendorName} · {campaign.campaignNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">
            {progress.currentTierPrice} {campaign.currency}
          </p>
          <p className="text-xs text-muted-foreground">Current unit price</p>
        </div>
      </header>

      {campaign.description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{campaign.description}</p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {progress.totalQuantity} / {campaign.targetQuantity} units joined
          </span>
          <span className="font-medium">{progress.progressPercentage}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress.progressPercentage}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {progress.participantCount} participant{progress.participantCount === 1 ? "" : "s"}
          {progress.isFunded ? " · Target reached" : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Pricing tiers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The unit price drops as more buyers join.
            </p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pr-4 pb-2">Quantity range</th>
                  <th className="pr-4 pb-2">Unit price</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground">Base price</td>
                  <td className="py-2 pr-4 font-medium">
                    {campaign.basePrice} {campaign.currency}
                  </td>
                </tr>
                {campaign.tiers.map((tier) => {
                  const isCurrent =
                    progress.totalQuantity >= tier.minQuantity &&
                    (tier.maxQuantity === null || progress.totalQuantity <= tier.maxQuantity);
                  return (
                    <tr
                      key={tier.id}
                      className={
                        isCurrent
                          ? "border-b border-border/50 bg-accent-soft/50"
                          : "border-b border-border/50"
                      }
                    >
                      <td className="py-2 pr-4">
                        {tier.minQuantity}
                        {tier.maxQuantity ? `–${tier.maxQuantity}` : "+"}
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {tier.unitPrice} {campaign.currency}
                        {isCurrent ? " ✓" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {campaign.participations.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-medium">Participants</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {campaign.participations.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0"
                  >
                    <span>{actor && p.buyerId === actor.id ? "You" : p.buyerName}</span>
                    <span className="text-muted-foreground">
                      {p.quantity} · {p.reservedPrice} {campaign.currency}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">
              {hasJoined ? "Your participation" : "Join this campaign"}
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Target</dt>
                <dd>{campaign.targetQuantity} units</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Joined</dt>
                <dd>{progress.totalQuantity} units</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ends</dt>
                <dd>{new Date(campaign.endsAt).toLocaleDateString()}</dd>
              </div>
            </dl>

            {isActive ? (
              <div className="mt-5">
                {actor ? (
                  <JoinForm campaignId={campaign.id} hasJoined={hasJoined} />
                ) : (
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(`/group-buy/${campaign.id}`)}`}
                    className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent/90"
                  >
                    Sign in to join
                  </Link>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                This campaign is {CAMPAIGN_STATUS_LABELS[campaign.status].toLowerCase()} and not
                accepting new participants.
              </p>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
