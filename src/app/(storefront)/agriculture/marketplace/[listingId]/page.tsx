import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { cropGlyph } from "@/components/agriculture/crop-icon";
import { ListingMedia, ProviderLabel } from "@/components/storefront/listing-card";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedListing } from "@/features/agriculture/queries";
import { unitLabel } from "@/features/agriculture/units";
import { decimalToCents } from "@/features/catalog/money";
import { isFeatureEnabled } from "@/features/flags/service";
import { getServerI18n } from "@/i18n/server";
import { getSessionActor } from "@/server/auth/session";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Produce listing",
  robots: { index: false, follow: true },
};

export default function ProduceDetailPage({ params }: { params: Promise<{ listingId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <ProduceDetailContent params={params} />
    </Suspense>
  );
}

async function ProduceDetailContent({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  if (!uuidSchema.safeParse(listingId).success) notFound();

  const { t, formatCurrency, formatNumber, formatDate } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const listing = enabled ? await getPublishedListing(listingId) : null;
  if (!listing) notFound();

  const actor = await getSessionActor();
  const verified = listing.providerVerified;
  const requestHref = actor
    ? "/agriculture/buyers"
    : `/sign-in?next=${encodeURIComponent("/agriculture/buyers")}`;

  return (
    <PageShell className="space-y-8 py-8">
      <Link
        href="/agriculture/marketplace"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {t("agriculture.detail.back")}
      </Link>

      <header>
        <p className="eyebrow text-muted-foreground">{t("marketplaces.farm")}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight tracking-tight text-balance">
              {listing.cropName}
              {listing.variety ? ` · ${listing.variety}` : ""}
            </h1>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-2xl font-medium tabular-nums">
                {formatCurrency(decimalToCents(listing.pricePerUnit), listing.currency)}
              </span>
              <span className="text-sm text-muted-foreground">/ {unitLabel(listing.unit, 2)}</span>
            </p>
          </div>
          <Badge tone={verified ? "success" : "neutral"}>
            {verified ? t("agriculture.detail.verified") : t("agriculture.detail.declared")}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <div className="space-y-6">
          <div className="max-w-xl">
            <ListingMedia
              tone="farm"
              icon={cropGlyph(listing.cropName)}
              image={listing.coverImageUrl}
              imageAlt={`${listing.cropName}${listing.variety ? ` ${listing.variety}` : ""}`}
              label={listing.collectionLocation}
              badge={
                <Badge tone={listing.deliveryAvailable ? "success" : "neutral"}>
                  {listing.deliveryAvailable
                    ? t("agriculture.detail.deliveryAvailable")
                    : t("agriculture.detail.collectionOnly")}
                </Badge>
              }
            />
          </div>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">{t("agriculture.detail.produce")}</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Fact
                label={t("agriculture.detail.available")}
                value={`${formatNumber(Number(listing.quantity))} ${unitLabel(
                  listing.unit,
                  Number(listing.quantity),
                )}`}
              />
              <Fact
                label={t("agriculture.detail.minimum")}
                value={`${formatNumber(Number(listing.minimumOrder))} ${unitLabel(
                  listing.unit,
                  Number(listing.minimumOrder),
                )}`}
              />
              {listing.grade ? (
                <Fact label={t("agriculture.detail.grade")} value={listing.grade} />
              ) : null}
              {listing.harvestDate ? (
                <Fact
                  label={t("agriculture.detail.harvest")}
                  value={formatDate(listing.harvestDate)}
                />
              ) : null}
              <Fact label={t("agriculture.detail.collection")} value={listing.collectionLocation} />
              <Fact
                label={t("agriculture.detail.delivery")}
                value={
                  listing.deliveryAvailable
                    ? t("agriculture.detail.deliveryAvailable")
                    : t("agriculture.detail.collectionOnly")
                }
              />
            </dl>

            {listing.organicClaim || listing.certifiedClaim ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="eyebrow text-muted-foreground">{t("agriculture.detail.claims")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {listing.organicClaim ? (
                    <Badge tone="accent">{t("agriculture.detail.organic")}</Badge>
                  ) : null}
                  {listing.certifiedClaim ? (
                    <Badge tone="accent">{t("agriculture.detail.certified")}</Badge>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 self-start lg:sticky lg:top-24">
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="eyebrow text-muted-foreground">{t("agriculture.detail.farmer")}</p>
            <div className="mt-3">
              <ProviderLabel
                name={listing.farmerName}
                meta={listing.farmerRegion ?? listing.farmerDistrict}
              />
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              {listing.farmName ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("agriculture.detail.farm")}</dt>
                  <dd className="text-right font-medium">{listing.farmName}</dd>
                </div>
              ) : null}
              {listing.farmerRegion ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("agriculture.detail.region")}</dt>
                  <dd className="text-right font-medium">
                    {[listing.farmerDistrict, listing.farmerRegion].filter(Boolean).join(", ")}
                  </dd>
                </div>
              ) : null}
              {listing.publishedAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("agriculture.detail.listed")}</dt>
                  <dd className="text-right font-medium">{formatDate(listing.publishedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/60 p-6">
            <h2 className="font-display text-lg font-medium">{t("agriculture.detail.ask")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("agriculture.detail.askBody")}</p>
            <Link
              href={requestHref}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent/90"
            >
              {t("agriculture.detail.ask")}
            </Link>
            <Link
              href="/agriculture/marketplace"
              className="mt-3 inline-flex w-full items-center justify-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("agriculture.detail.back")}
            </Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
