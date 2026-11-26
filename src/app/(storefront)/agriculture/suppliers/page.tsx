import type { Metadata } from "next";

import {
  BookingDecisionForm,
  BookingQuoteForm,
  InputForm,
  ServiceForm,
  SupplierProfileForm,
} from "@/components/agriculture/supplier-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { isFeatureEnabled } from "@/features/flags/service";
import {
  getSupplierProfile,
  listInputOrders,
  listSupplierBookings,
} from "@/features/agriculture/supplier-queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agricultural supplier portal",
  robots: { index: false, follow: false },
};

export default async function SupplierPortalPage() {
  const actor = await requireActor("/agriculture/suppliers");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [supplier, bookings, orders] = await Promise.all([
    getSupplierProfile(actor.id),
    getSupplierProfile(actor.id).then((row) => (row ? listSupplierBookings(row.id) : [])),
    getSupplierProfile(actor.id).then((row) =>
      row ? listInputOrders({ supplierId: row.id }) : [],
    ),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Agricultural supplier portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified input sellers and service providers. Publishing requires verification.
        </p>
        {supplier ? (
          <Badge tone={supplier.verificationStatus === "VERIFIED" ? "success" : "neutral"}>
            {supplier.verificationStatus}
          </Badge>
        ) : null}
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Supplier profile</h2>
        <div className="mt-4">
          <SupplierProfileForm />
        </div>
      </section>

      {supplier?.verificationStatus === "VERIFIED" ? (
        <>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Input catalogue</h2>
            <div className="mt-4">
              <InputForm />
            </div>
          </section>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Services</h2>
            <div className="mt-4">
              <ServiceForm />
            </div>
          </section>
        </>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Service bookings</h2>
        {bookings.map((booking) => (
          <article
            key={booking.id}
            className="space-y-2 rounded-xl border border-border bg-surface p-5 text-sm"
          >
            <p>
              {booking.bookingNumber} · {booking.serviceTitle} · {booking.status}
            </p>
            <p className="text-xs text-muted-foreground">
              Requested for {new Date(booking.requestedFor).toLocaleDateString()}
              {booking.quoteAmount ? ` · quote ${booking.quoteAmount} ${booking.currency}` : ""}
              {booking.scheduledAt
                ? ` · scheduled ${new Date(booking.scheduledAt).toLocaleString()}`
                : ""}
            </p>
            {booking.status === "REQUESTED" && supplier?.verificationStatus === "VERIFIED" ? (
              <BookingQuoteForm bookingId={booking.id} />
            ) : null}
            <BookingDecisionForm bookingId={booking.id} status={booking.status} />
          </article>
        ))}
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Input orders</h2>
        {orders.map((order) => (
          <p key={order.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            {order.inputName} · {order.quantity} {order.unit} · {order.total} {order.currency} ·{" "}
            {order.status}
            {order.paymentStatus ? ` · payment ${order.paymentStatus}` : ""}
          </p>
        ))}
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No input orders yet.</p>
        ) : null}
      </section>
    </PageShell>
  );
}
