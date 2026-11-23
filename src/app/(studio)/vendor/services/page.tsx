import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listVendorServiceListings } from "@/features/services/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Studio services",
  robots: { index: false, follow: false },
};

export default function VendorServicesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <VendorServicesContent />
    </Suspense>
  );
}

async function VendorServicesContent() {
  const access = await requireStudioAccess("services.manage", "/vendor/services");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.servicesMarketplace");

  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight">{t("services.title")}</h1>
        </header>
        <EmptyState title="Coming soon" description={t("services.comingSoon")} />
      </PageShell>
    );
  }

  const listings = await listVendorServiceListings(access.vendorId);

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("services.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("services.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/vendor/group-buy"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm hover:bg-surface-muted"
          >
            {t("groupBuy.title")}
          </Link>
          <Link
            href="/vendor/services/bookings"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm hover:bg-surface-muted"
          >
            {t("services.bookings")}
          </Link>
          <Link
            href="/vendor/services/new"
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            {t("services.newListing")}
          </Link>
        </div>
      </header>

      {listings.length === 0 ? (
        <EmptyState title="No services yet" description={t("services.empty")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{listing.listingNumber}</p>
                <p className="font-medium">
                  <Link href={`/vendor/services/${listing.id}`} className="hover:underline">
                    {listing.title}
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  {listing.unitPrice} {listing.currency} ·{" "}
                  {t("services.duration", { minutes: listing.durationMinutes })}
                </p>
              </div>
              <Badge tone={listing.status === "ACTIVE" ? "success" : "neutral"}>
                {listing.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
