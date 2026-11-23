import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BuyerNav } from "@/components/b2b/nav";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listActiveWholesaleListings } from "@/features/b2b/queries";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Wholesale catalog",
  robots: { index: false, follow: false },
};

export default function BuyerWholesalePage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <BuyerWholesaleContent />
    </Suspense>
  );
}

async function BuyerWholesaleContent() {
  await requireBuyerContext("/b2b/wholesale");
  const { t } = await getServerI18n();
  const listings = await listActiveWholesaleListings();

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("b2b.catalog")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
        </div>
        <Link
          href="/b2b/rfq/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          {t("b2b.newRfq")}
        </Link>
      </header>
      <BuyerNav />
      {listings.length === 0 ? (
        <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{listing.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {listing.vendorName} · {listing.sku}
                  </p>
                </div>
                <p className="text-sm font-medium">
                  {listing.unitPrice} {listing.currency}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>{t("b2b.minimumOrder")}</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{listing.minimumOrder}</dd>
                </div>
                <div>
                  <dt>{t("b2b.stock")}</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{listing.stockAvailable}</dd>
                </div>
                <div>
                  <dt>{t("b2b.leadTime")}</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{listing.leadTimeDays}</dd>
                </div>
              </dl>
              {listing.tiers.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("b2b.tiers")}</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {listing.tiers.map((tier) => (
                      <li
                        key={tier.minQty}
                        className="rounded-sm border border-border px-2 py-1 font-mono text-[0.625rem]"
                      >
                        {tier.minQty}
                        {tier.maxQty ? `–${tier.maxQty}` : "+"} · {tier.unitPrice}{" "}
                        {listing.currency}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link
                href={`/b2b/rfq/new?supplier=${listing.vendorId}`}
                className="inline-block text-sm text-accent hover:underline"
              >
                {t("b2b.newRfq")} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
