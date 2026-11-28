import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { agricultureSectionGroups } from "@/components/agriculture/agriculture-sections";
import {
  BookingDecisionForm,
  BookingQuoteForm,
  InputForm,
  ServiceForm,
  SupplierProfileForm,
} from "@/components/agriculture/supplier-forms";
import {
  ConsoleEmpty,
  ConsolePageHeader,
  ConsoleSection,
  ConsoleStat,
} from "@/components/console/console-ui";
import { Button } from "@/components/ui/button";
import { isFeatureEnabled } from "@/features/flags/service";
import {
  getSupplierProfile,
  listInputOrders,
  listSupplierBookings,
  listSupplierInputs,
  listSupplierServices,
} from "@/features/agriculture/supplier-queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Supplier portal",
  robots: { index: false, follow: false },
};

export default async function SupplierPortalPage() {
  const actor = await requireActor("/agriculture/suppliers");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");

  const supplier = await getSupplierProfile(actor.id);
  const [services, bookings, orders] = await Promise.all([
    supplier ? listSupplierServices(supplier.id) : Promise.resolve([]),
    supplier ? listSupplierBookings(supplier.id) : Promise.resolve([]),
    supplier ? listInputOrders({ supplierId: supplier.id }) : Promise.resolve([]),
  ]);

  const verified = supplier?.verificationStatus === "VERIFIED";
  const publishedServices = services.filter((service) => service.status === "PUBLISHED");
  const quoteRequests = bookings.filter((booking) => booking.status === "REQUESTED");
  const activeBookings = bookings.filter((booking) =>
    ["QUOTED", "CONFIRMED", "IN_PROGRESS"].includes(booking.status),
  );
  const openOrders = orders.filter((order) => order.status !== "CANCELLED");
  const paidOrders = orders.filter((order) => order.status === "PAID");

  const steps = [
    !supplier
      ? {
          title: t("agriculture.supplierPortal.attention.profileTitle"),
          body: t("agriculture.supplierPortal.attention.profileBody"),
          href: "#profile",
          action: t("agriculture.supplierPortal.attention.profileAction"),
        }
      : null,
    supplier && !verified
      ? {
          title: t("agriculture.supplierPortal.attention.verifyTitle"),
          body: t("agriculture.supplierPortal.attention.verifyBody"),
          href: "#profile",
          action: t("agriculture.supplierPortal.attention.verifyAction"),
        }
      : null,
    verified && services.length === 0
      ? {
          title: t("agriculture.supplierPortal.attention.publishTitle"),
          body: t("agriculture.supplierPortal.attention.publishBody"),
          href: "#services",
          action: t("agriculture.supplierPortal.attention.publishAction"),
        }
      : null,
    quoteRequests.length > 0
      ? {
          title: t("agriculture.supplierPortal.attention.quoteTitle"),
          body: t("agriculture.supplierPortal.attention.quoteBody"),
          href: "#bookings",
          action: t("agriculture.supplierPortal.attention.quoteAction"),
        }
      : null,
  ].filter((step): step is NonNullable<typeof step> => step !== null);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t("agriculture.supplierPortal.eyebrow")}
        title={t("agriculture.supplierPortal.title")}
        description={t("agriculture.supplierPortal.description")}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="#profile">
              {t("agriculture.supplierPortal.manageProfile")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          {t("agriculture.supplierPortal.disabled")}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ConsoleStat
          label={t("agriculture.supplierPortal.stats.verification")}
          value={supplier?.verificationStatus ?? t("agriculture.supplierPortal.stats.noProfile")}
          hint={t("agriculture.supplierPortal.stats.verificationHint")}
          href="#profile"
          tone={verified ? "success" : "warning"}
        />
        <ConsoleStat
          label={t("agriculture.supplierPortal.stats.services")}
          value={publishedServices.length}
          hint={t("agriculture.supplierPortal.stats.servicesHint")}
          href="#services"
        />
        <ConsoleStat
          label={t("agriculture.supplierPortal.stats.bookings")}
          value={activeBookings.length}
          hint={t("agriculture.supplierPortal.stats.bookingsHint")}
          href="#bookings"
          tone={quoteRequests.length > 0 ? "warning" : "neutral"}
        />
        <ConsoleStat
          label={t("agriculture.supplierPortal.stats.orders")}
          value={paidOrders.length}
          hint={t("agriculture.supplierPortal.stats.ordersHint")}
          href="#orders"
        />
      </div>

      <ConsoleSection
        title={t("agriculture.supplierPortal.attention.title")}
        description={t("agriculture.supplierPortal.attention.body")}
      >
        {steps.length > 0 ? (
          <ul className="divide-y divide-border">
            {steps.map((step) => (
              <li
                key={step.title}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.body}</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href={step.href}>
                    {step.action}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {t("agriculture.supplierPortal.attention.empty")}
          </p>
        )}
      </ConsoleSection>

      <div id="profile" className="scroll-mt-32">
        <ConsoleSection
          title={t("agriculture.supplierPortal.profile.title")}
          description={t("agriculture.supplierPortal.profile.body")}
        >
          {supplier ? (
            <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium">{supplier.businessName}</span>
              <span className="text-xs text-muted-foreground">
                {supplier.type.replaceAll("_", " ").toLowerCase()}
                {supplier.region ? ` · ${supplier.region}` : ""}
                {supplier.district ? `, ${supplier.district}` : ""}
              </span>
            </p>
          ) : null}
          <SupplierProfileForm />
        </ConsoleSection>
      </div>

      <div id="services" className="scroll-mt-32">
        <ConsoleSection
          title={t("agriculture.supplierPortal.services.title")}
          description={t("agriculture.supplierPortal.services.body")}
        >
          {services.length === 0 ? (
            <ConsoleEmpty>{t("agriculture.supplierPortal.services.empty")}</ConsoleEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {service.title} · {service.serviceType.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {service.rateAmount} {service.currency}{" "}
                      {service.rateUnit.replaceAll("_", " ").toLowerCase()}
                      {service.serviceArea ? ` · ${service.serviceArea}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{service.status}</span>
                </li>
              ))}
            </ul>
          )}

          {verified ? (
            <div className="mt-4 border-t border-border pt-4">
              <ServiceForm />
            </div>
          ) : null}
        </ConsoleSection>
      </div>

      <div id="catalogue" className="scroll-mt-32">
        <ConsoleSection
          title={t("agriculture.supplierPortal.catalogue.title")}
          description={t("agriculture.supplierPortal.catalogue.body")}
        >
          {supplier ? <SupplierInputsList supplierId={supplier.id} /> : null}
          {verified ? (
            <div className="mt-4 border-t border-border pt-4">
              <InputForm />
            </div>
          ) : null}
        </ConsoleSection>
      </div>

      <div id="bookings" className="scroll-mt-32">
        <ConsoleSection
          title={t("agriculture.supplierPortal.bookings.title")}
          description={t("agriculture.supplierPortal.bookings.body")}
        >
          {bookings.length === 0 ? (
            <ConsoleEmpty>{t("agriculture.supplierPortal.bookings.empty")}</ConsoleEmpty>
          ) : (
            <ul className="space-y-3">
              {bookings.map((booking) => (
                <li
                  key={booking.id}
                  className="space-y-2 rounded-lg border border-border p-4 text-sm last:mb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">
                        {booking.bookingNumber}
                      </span>{" "}
                      · {booking.serviceTitle}
                    </p>
                    <span className="text-xs text-muted-foreground">{booking.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("agriculture.supplierPortal.bookings.requestedFor")}:{" "}
                    {new Date(booking.requestedFor).toLocaleDateString()}
                    {booking.quoteAmount ? ` · ${booking.quoteAmount} ${booking.currency}` : ""}
                    {booking.scheduledAt
                      ? ` · ${new Date(booking.scheduledAt).toLocaleDateString()}`
                      : ""}
                  </p>
                  {booking.quoteNote ? (
                    <p className="text-xs text-muted-foreground">{booking.quoteNote}</p>
                  ) : null}
                  {booking.status === "REQUESTED" && verified ? (
                    <BookingQuoteForm bookingId={booking.id} />
                  ) : null}
                  <BookingDecisionForm bookingId={booking.id} status={booking.status} />
                </li>
              ))}
            </ul>
          )}
        </ConsoleSection>
      </div>

      <div id="orders" className="scroll-mt-32">
        <ConsoleSection
          title={t("agriculture.supplierPortal.orders.title")}
          description={t("agriculture.supplierPortal.orders.body")}
        >
          {orders.length === 0 ? (
            <ConsoleEmpty>{t("agriculture.supplierPortal.orders.empty")}</ConsoleEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {openOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <span>
                    {order.inputName} · {order.quantity} {order.unit}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {order.total} {order.currency} · {order.status}
                    {order.paymentStatus ? ` · payment ${order.paymentStatus}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ConsoleSection>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-medium">
            {t("agriculture.supplierPortal.modules.title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("agriculture.supplierPortal.modules.body")}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agricultureSectionGroups.map((group) => (
            <div key={group.key} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-mono text-[0.5625rem] tracking-[0.16em] text-muted-foreground uppercase">
                {t(`agriculture.console.groups.${group.key}`)}
              </p>
              <ul className="mt-2.5 space-y-0.5">
                {group.items.map((section) => (
                  <li key={section.key}>
                    <Link
                      href={section.href}
                      className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      <section.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {t(`agriculture.console.nav.${section.key}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function SupplierInputsList({ supplierId }: { supplierId: string }) {
  const { t } = await getServerI18n();
  const inputs = await listSupplierInputs(supplierId);

  if (inputs.length === 0) {
    return <ConsoleEmpty>{t("agriculture.supplierPortal.catalogue.empty")}</ConsoleEmpty>;
  }

  return (
    <ul className="divide-y divide-border">
      {inputs.map((input) => (
        <li
          key={input.id}
          className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
        >
          <span>
            {input.name} · {input.category.replaceAll("_", " ").toLowerCase()}
          </span>
          <span className="text-xs text-muted-foreground">
            {input.quantity} {input.unit} · {input.pricePerUnit} {input.currency} · {input.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
