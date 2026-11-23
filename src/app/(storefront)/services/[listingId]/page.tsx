import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ServiceBookingForm } from "@/components/storefront/service-booking-form";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { getActiveServiceListing } from "@/features/services/queries";
import { getServerI18n } from "@/i18n/server";
import { getSessionActor } from "@/server/auth/session";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Service detail",
  robots: { index: false, follow: true },
};

export default function ServiceDetailPage({ params }: { params: Promise<{ listingId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <ServiceDetailContent params={params} />
    </Suspense>
  );
}

async function ServiceDetailContent({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  if (!uuidSchema.safeParse(listingId).success) notFound();

  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.servicesMarketplace");
  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <Link href="/services" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("services.browse")}
        </Link>
        <EmptyState title="Coming soon" description={t("services.comingSoon")} />
      </PageShell>
    );
  }

  const listing = await getActiveServiceListing(listingId);
  if (!listing) notFound();

  const actor = await getSessionActor();

  return (
    <PageShell className="space-y-6 py-8">
      <Link href="/services" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("services.browse")}
      </Link>

      <header>
        <h1 className="font-display text-3xl tracking-tight">{listing.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("services.provider")}: {listing.vendorName} · {listing.listingNumber}
        </p>
      </header>

      {listing.description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{listing.description}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Service details</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">{t("services.price")}</dt>
                <dd className="font-medium">
                  {listing.unitPrice} {listing.currency}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-medium">
                  {t("services.duration", { minutes: listing.durationMinutes })}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">{t("services.location")}</dt>
                <dd className="font-medium">{listing.location || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">{t("services.status")}</dt>
                <dd className="font-medium">{listing.status}</dd>
              </div>
            </dl>
          </div>
        </section>

        <aside>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">{t("services.book")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a time and the studio will confirm your booking.
            </p>
            <div className="mt-5">
              {actor ? (
                <ServiceBookingForm listingId={listing.id} />
              ) : (
                <Link
                  href={`/sign-in?next=${encodeURIComponent(`/services/${listing.id}`)}`}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent/90"
                >
                  Sign in to book
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
