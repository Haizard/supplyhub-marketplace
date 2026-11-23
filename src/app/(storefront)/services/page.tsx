import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listActiveServiceListings } from "@/features/services/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Services marketplace",
  description: "Book services from verified studios.",
};

export default function ServicesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <ServicesContent />
    </Suspense>
  );
}

async function ServicesContent() {
  const { t } = await getServerI18n();
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
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("services.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("services.subtitle")}</p>
      </header>

      {listings.length === 0 ? (
        <EmptyState title="No services yet" description={t("services.empty")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <h2 className="text-base font-semibold">
                  <Link href={`/services/${listing.id}`} className="hover:underline">
                    {listing.title}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("services.provider")}: {listing.vendorName}
                </p>
              </div>
              {listing.description ? (
                <p className="line-clamp-3 text-sm text-muted-foreground">{listing.description}</p>
              ) : null}
              <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>{t("services.price")}</dt>
                  <dd className="mt-0.5 text-sm text-foreground">
                    {listing.unitPrice} {listing.currency}
                  </dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd className="mt-0.5 text-sm text-foreground">
                    {t("services.duration", { minutes: listing.durationMinutes })}
                  </dd>
                </div>
              </dl>
              {listing.location ? (
                <p className="text-xs text-muted-foreground">
                  {t("services.location")}: {listing.location}
                </p>
              ) : null}
              <Link
                href={`/services/${listing.id}`}
                className="inline-block text-sm text-accent hover:underline"
              >
                {t("services.book")} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
