import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ServiceBookingStatusActions } from "@/components/vendor/service-booking-status-actions";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listVendorServiceBookings } from "@/features/services/queries";
import { BOOKING_STATUS_LABELS } from "@/features/services/status";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Service bookings",
  robots: { index: false, follow: false },
};

export default function VendorServiceBookingsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <VendorServiceBookingsContent />
    </Suspense>
  );
}

async function VendorServiceBookingsContent() {
  const access = await requireStudioAccess("services.manage", "/vendor/services/bookings");
  const { t, formatDate, formatTime } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.servicesMarketplace");

  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <EmptyState title="Coming soon" description={t("services.comingSoon")} />
      </PageShell>
    );
  }

  const bookings = await listVendorServiceBookings(access.vendorId);

  return (
    <PageShell className="space-y-6 py-8">
      <Link href="/vendor/services" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("services.title")}
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("services.bookings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review requests and move bookings through their lifecycle.
        </p>
      </header>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" description={t("services.emptyBookings")} />
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{booking.bookingNumber}</p>
                  <p className="font-medium">{booking.listingTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {booking.buyerName} · {formatDate(booking.scheduledAt)} ·{" "}
                    {formatTime(booking.scheduledAt)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={booking.status === "COMPLETED" ? "success" : "neutral"}>
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </Badge>
                  <p className="mt-1 text-sm">
                    {booking.unitPrice} {booking.currency}
                  </p>
                </div>
              </div>
              {booking.note ? (
                <p className="text-sm text-muted-foreground">Note: {booking.note}</p>
              ) : null}
              <ServiceBookingStatusActions bookingId={booking.id} status={booking.status} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
