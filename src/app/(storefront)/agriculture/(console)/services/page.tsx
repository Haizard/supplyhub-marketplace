import type { Metadata } from "next";

import { BookingRequestForm } from "@/components/agriculture/supplier-forms";
import { ConsolePageHeader, ConsoleSection, ConsoleStat } from "@/components/console/console-ui";
import { isFeatureEnabled } from "@/features/flags/service";
import { getFarmerSummary } from "@/features/agriculture/queries";
import { listFarmerBookings, listPublishedServices } from "@/features/agriculture/supplier-queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agricultural services",
  robots: { index: false, follow: false },
};

export default async function AgriculturalServicesPage() {
  const actor = await requireActor("/agriculture/services");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [services, farmer] = await Promise.all([
    listPublishedServices(),
    getFarmerSummary(actor.id),
  ]);
  const bookings = farmer ? await listFarmerBookings(farmer.id) : [];
  const openBookings = bookings.filter((booking) => booking.status !== "COMPLETED");

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t("agriculture.servicesPage.eyebrow")}
        title={t("agriculture.servicesPage.title")}
        description={t("agriculture.servicesPage.description")}
      />

      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleStat
          label={t("agriculture.servicesPage.stats.available")}
          value={services.length}
          hint={t("agriculture.servicesPage.stats.availableHint")}
        />
        <ConsoleStat
          label={t("agriculture.servicesPage.stats.bookings")}
          value={openBookings.length}
          hint={t("agriculture.servicesPage.stats.bookingsHint")}
          tone={openBookings.length > 0 ? "warning" : "neutral"}
        />
      </div>

      {farmer ? (
        <ConsoleSection
          title={t("agriculture.servicesPage.requestTitle")}
          description={t("agriculture.servicesPage.requestBody")}
        >
          <BookingRequestForm
            services={services.map((service) => ({ id: service.id, title: service.title }))}
          />
        </ConsoleSection>
      ) : null}

      <ConsoleSection
        title={t("agriculture.servicesPage.availableTitle")}
        description={t("agriculture.servicesPage.availableBody")}
      >
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("agriculture.servicesPage.availableEmpty")}
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {services.map((service) => (
              <li
                key={service.id}
                className="rounded-lg border border-border p-4 text-sm transition-colors hover:border-border-strong"
              >
                <p className="font-medium">
                  {service.title} · {service.serviceType.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {service.rateAmount} {service.currency}{" "}
                  {service.rateUnit.replaceAll("_", " ").toLowerCase()} · {service.supplierName} (
                  {service.verificationStatus})
                </p>
                {service.serviceArea || service.qualificationRef ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {service.serviceArea ?? ""}
                    {service.qualificationRef
                      ? `${service.serviceArea ? " · " : ""}qualified: ${service.qualificationRef}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ConsoleSection>

      <ConsoleSection
        title={t("agriculture.servicesPage.bookingsTitle")}
        description={t("agriculture.servicesPage.bookingsBody")}
      >
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("agriculture.servicesPage.bookingsEmpty")}
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-b-0"
              >
                <span>
                  <span className="font-mono text-xs">{booking.bookingNumber}</span> ·{" "}
                  {booking.serviceTitle}
                </span>
                <span className="text-xs text-muted-foreground">
                  {booking.status}
                  {booking.quoteAmount ? ` · ${booking.quoteAmount} ${booking.currency}` : ""}
                  {booking.scheduledAt
                    ? ` · ${new Date(booking.scheduledAt).toLocaleDateString()}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ConsoleSection>
    </div>
  );
}
