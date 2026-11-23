import type { Metadata } from "next";
import { Suspense } from "react";

import { ActionButton, WholesaleListingForm } from "@/components/b2b/forms";
import { SellerB2bNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { archiveWholesaleListingAction } from "@/features/b2b/actions";
import { listVendorProducts, listVendorWholesaleListings } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Wholesale listings",
  robots: { index: false, follow: false },
};

export default function VendorWholesalePage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <VendorWholesaleContent />
    </Suspense>
  );
}

async function VendorWholesaleContent() {
  const access = await requireStudioAccess("wholesale.manage", "/vendor/wholesale");
  const { t } = await getServerI18n();
  const [listings, products] = await Promise.all([
    listVendorWholesaleListings(access.vendorId),
    listVendorProducts(access.vendorId),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("b2b.listings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
      </header>
      <SellerB2bNav />

      {listings.length === 0 ? (
        <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{listing.title}</p>
                  <B2bStatusBadge status={listing.status} />
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {listing.listingNumber} · {listing.sku} · {listing.minimumOrder}{" "}
                  {t("b2b.minimumOrder")}
                </p>
                <p className="mt-1 text-sm">
                  {listing.unitPrice} {listing.currency}
                </p>
                {listing.tiers.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("b2b.tiers")}:{" "}
                    {listing.tiers.map((tier) => `${tier.minQty}+ = ${tier.unitPrice}`).join(", ")}
                  </p>
                ) : null}
              </div>
              {listing.status !== "CLOSED" ? (
                <ActionButton
                  action={archiveWholesaleListingAction}
                  hidden={{ listingId: listing.id }}
                  label={t("b2b.closeListing")}
                  variant="secondary"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <WholesaleListingForm vendorId={access.vendorId} products={products} />
    </PageShell>
  );
}
