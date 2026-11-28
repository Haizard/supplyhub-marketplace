import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { cropGlyph } from "@/components/agriculture/crop-icon";
import { PageShell } from "@/components/storefront/page-shell";
import {
  ListingBody,
  ListingCard,
  ListingFooter,
  ListingMedia,
  ListingPrice,
  ListingSummary,
  ListingTitle,
  ProviderLabel,
} from "@/components/storefront/listing-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listOpenBuyerRequests, listPublishedListings } from "@/features/agriculture/queries";
import { isFeatureEnabled } from "@/features/flags/service";
import { unitLabel } from "@/features/agriculture/units";
import { decimalToCents } from "@/features/catalog/money";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Agricultural marketplace",
  robots: { index: false, follow: false },
};

export default function AgricultureMarketplacePage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <AgricultureMarketplaceContent />
    </Suspense>
  );
}

async function AgricultureMarketplaceContent() {
  const { t, formatDate, formatNumber, formatCurrency } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [listings, requests] = await Promise.all([
    listPublishedListings(),
    listOpenBuyerRequests(),
  ]);

  return (
    <PageShell className="space-y-10 py-8">
      <header>
        <p className="eyebrow text-muted-foreground">Farm produce</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Agricultural marketplace</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Produce listings and bulk buyer requests. Claims are seller-declared until independently
          verified.
        </p>
        <Link
          href="/agriculture/farmer"
          className="mt-3 inline-flex text-xs font-medium text-accent underline-offset-4 hover:underline"
        >
          {t("agriculture.sell")}
        </Link>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Produce listings</h2>
          <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            {t("marketplaces.allListings", { count: listings.length })}
          </p>
        </div>
        {listings.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
            {listings.map((listing) => {
              return (
                <ListingCard key={listing.id}>
                  <ListingMedia
                    href={`/agriculture/marketplace/${listing.id}`}
                    tone="farm"
                    icon={cropGlyph(listing.cropName)}
                    image={listing.coverImageUrl}
                    imageAlt={`${listing.cropName}${listing.variety ? ` ${listing.variety}` : ""}`}
                    label={listing.collectionLocation}
                    badge={
                      listing.providerVerified ? (
                        <Badge tone="success">{t("providers.verifiedShort")}</Badge>
                      ) : (
                        <Badge tone="neutral">{t("providers.declaredShort")}</Badge>
                      )
                    }
                  />
                  <ListingBody>
                    <ListingPrice suffix={`/ ${listing.unit.toLowerCase()}`}>
                      {formatCurrency(decimalToCents(listing.pricePerUnit), listing.currency)}
                    </ListingPrice>
                    <ListingTitle href={`/agriculture/marketplace/${listing.id}`}>
                      {listing.cropName}
                      {listing.variety ? ` · ${listing.variety}` : ""}
                    </ListingTitle>
                    <ListingSummary>
                      {formatNumber(Number(listing.quantity))}{" "}
                      {unitLabel(listing.unit, Number(listing.quantity))} available · min{" "}
                      {formatNumber(Number(listing.minimumOrder))}{" "}
                      {unitLabel(listing.unit, Number(listing.minimumOrder))}
                    </ListingSummary>
                    <ListingFooter>
                      <ProviderLabel
                        name={listing.farmerName}
                        meta={listing.deliveryAvailable ? "Delivery" : "Collection only"}
                      />
                    </ListingFooter>
                  </ListingBody>
                </ListingCard>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No published listings.</p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Bulk buyer requests</h2>
          <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            {t("marketplaces.allRequests", { count: requests.length })}
          </p>
        </div>
        {requests.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors duration-300 hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="eyebrow text-muted-foreground">Buyer request</p>
                  <Badge tone="accent">
                    {formatNumber(Number(request.quantity))}{" "}
                    {unitLabel(request.unit, Number(request.quantity))}
                  </Badge>
                </div>
                <h3 className="mt-2 font-display text-base font-medium tracking-[-0.01em]">
                  {request.productName}
                </h3>
                {request.qualitySpec ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {request.qualitySpec}
                  </p>
                ) : null}
                <dl className="mt-auto grid grid-cols-2 gap-3 pt-4 text-xs">
                  <div>
                    <dt className="eyebrow text-muted-foreground">Delivery by</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {formatDate(request.deliveryDeadline)}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow text-muted-foreground">Offers by</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {formatDate(request.offerDeadline)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 truncate border-t border-border pt-3 font-mono text-[0.625rem] tracking-[0.13em] text-muted-foreground uppercase">
                  {request.deliveryLocation}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No open buyer requests.</p>
        )}
      </section>
    </PageShell>
  );
}
