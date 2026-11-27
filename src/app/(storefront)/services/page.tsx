import type { Metadata } from "next";
import { Camera, Clock, Coffee, Sparkles, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

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
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { decimalToCents } from "@/features/catalog/money";
import { isFeatureEnabled } from "@/features/flags/service";
import { listActiveServiceListings } from "@/features/services/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Services marketplace",
  description: "Book services from verified studios.",
};

const SERVICE_ICONS: { match: RegExp; icon: typeof Sparkles }[] = [
  { match: /pottery|ceramic|clay|wheel|craft/i, icon: Sparkles },
  { match: /photo|camera|shoot|film|video/i, icon: Camera },
  { match: /coffee|cupping|roast|tea|barista/i, icon: Coffee },
  { match: /catering|food|tasting|menu|chef/i, icon: UtensilsCrossed },
];

function serviceIcon(title: string) {
  return SERVICE_ICONS.find((entry) => entry.match.test(title))?.icon ?? Sparkles;
}

/** "Kitchen, Dar es Salaam" reads best on the plate as just the city. */
function serviceArea(location: string) {
  const parts = location.split(",").map((part) => part.trim());
  return parts[parts.length - 1] ?? "";
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <ServicesContent />
    </Suspense>
  );
}

async function ServicesContent() {
  const { t, formatCurrency } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.servicesMarketplace");

  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight">{t("services.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("services.subtitle")}</p>
        </header>
        <EmptyState title="Coming soon" description={t("services.comingSoon")} />
      </PageShell>
    );
  }

  const listings = await listActiveServiceListings();

  return (
    <PageShell className="space-y-8 py-8">
      <header>
        <p className="eyebrow text-muted-foreground">{t("marketplaces.services")}</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">{t("services.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("services.subtitle")}</p>
        <Link
          href="/vendor/services/new"
          className="mt-3 inline-flex text-xs font-medium text-accent underline-offset-4 hover:underline"
        >
          {t("services.newListing")}
        </Link>
      </header>

      {listings.length === 0 ? (
        <EmptyState title="No services yet" description={t("services.empty")} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
          {listings.map((listing) => {
            const Icon = serviceIcon(listing.title);
            return (
              <ListingCard key={listing.id}>
                <ListingMedia
                  href={`/services/${listing.id}`}
                  tone="services"
                  icon={<Icon className="size-[46%]" strokeWidth={1.25} aria-hidden="true" />}
                  label={serviceArea(listing.location) || listing.vendorName}
                  badge={
                    <Badge tone="neutral">
                      <Clock className="size-2.5" aria-hidden="true" />
                      {listing.durationMinutes} min
                    </Badge>
                  }
                />
                <ListingBody>
                  <ListingPrice suffix={`/ ${t("services.session")}`}>
                    {formatCurrency(decimalToCents(listing.unitPrice), listing.currency)}
                  </ListingPrice>
                  <ListingTitle href={`/services/${listing.id}`}>{listing.title}</ListingTitle>
                  {listing.description ? (
                    <ListingSummary>{listing.description}</ListingSummary>
                  ) : null}
                  <ListingFooter>
                    <ProviderLabel name={listing.vendorName} />
                  </ListingFooter>
                </ListingBody>
              </ListingCard>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
