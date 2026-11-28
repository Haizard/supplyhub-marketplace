import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ServiceListingArchiveForm } from "@/components/vendor/service-listing-archive-form";
import { ServiceListingForm } from "@/components/vendor/service-listing-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { getVendorServiceListing } from "@/features/services/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Edit service",
  robots: { index: false, follow: false },
};

export default function EditServicePage({ params }: { params: Promise<{ listingId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <EditServiceContent params={params} />
    </Suspense>
  );
}

async function EditServiceContent({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  if (!uuidSchema.safeParse(listingId).success) notFound();

  const access = await requireStudioAccess("services.manage", "/vendor/services");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.servicesMarketplace");
  const listing = await getVendorServiceListing(listingId, access.vendorId);
  if (!listing) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <Link href="/vendor/services" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("services.title")}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-tight">{t("services.editListing")}</h1>
        {enabled ? (
          <ServiceListingArchiveForm
            listingId={listing.id}
            archived={listing.status === "ARCHIVED"}
          />
        ) : null}
      </header>

      {enabled ? (
        <div className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <ServiceListingForm
            vendorId={access.vendorId}
            listing={{
              id: listing.id,
              title: listing.title,
              description: listing.description,
              currency: listing.currency,
              unitPrice: listing.unitPrice,
              durationMinutes: listing.durationMinutes,
              location: listing.location,
              coverImageUrl: listing.coverImageUrl,
            }}
          />
        </div>
      ) : null}
    </PageShell>
  );
}
