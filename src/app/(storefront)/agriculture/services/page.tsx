import type { Metadata } from "next";

import { BookingRequestForm } from "@/components/agriculture/supplier-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { isFeatureEnabled } from "@/features/flags/service";
import { listFarmerBookings } from "@/features/agriculture/supplier-queries";
import { listPublishedServices } from "@/features/agriculture/supplier-queries";
import { getFarmerSummary } from "@/features/agriculture/queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agricultural services",
  robots: { index: false, follow: false },
};

export default async function AgriculturalServicesPage() {
  const actor = await requireActor("/agriculture/services");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [services, farmer] = await Promise.all([
    listPublishedServices(),
    getFarmerSummary(actor.id),
  ]);
  const bookings = farmer ? await listFarmerBookings(farmer.id) : [];

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Agricultural services</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tractor hire, ploughing, spraying, harvesting, soil testing, agronomy, transport and
          storage.
        </p>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      {farmer ? (
        <BookingRequestForm
          services={services.map((service) => ({ id: service.id, title: service.title }))}
        />
      ) : null}

      {services.map((service) => (
        <article
          key={service.id}
          className="rounded-xl border border-border bg-surface p-5 text-sm"
        >
          <p className="font-medium">
            {service.title} · {service.serviceType.replaceAll("_", " ")}
          </p>
          <p className="text-xs text-muted-foreground">
            {service.rateAmount} {service.currency} {service.rateUnit} · {service.supplierName} (
            {service.verificationStatus}){service.serviceArea ? ` · ${service.serviceArea}` : ""}
            {service.qualificationRef ? ` · qualified: ${service.qualificationRef}` : ""}
          </p>
        </article>
      ))}
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services published.</p>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">My bookings</h2>
        {bookings.map((booking) => (
          <p key={booking.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            {booking.bookingNumber} · {booking.serviceTitle} · {booking.status}
            {booking.quoteAmount ? ` · ${booking.quoteAmount} ${booking.currency}` : ""}
            {booking.scheduledAt ? ` · ${new Date(booking.scheduledAt).toLocaleString()}` : ""}
          </p>
        ))}
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : null}
      </section>
    </PageShell>
  );
}
