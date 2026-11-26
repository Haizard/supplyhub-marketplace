import type { Metadata } from "next";
import Link from "next/link";

import {
  AgriculturalDeliveryForm,
  CentreForm,
  IntakeDecisionForm,
  IntakeForm,
  StorageBookingForm,
  StorageDecisionForm,
  StorageFacilityForm,
} from "@/components/agriculture/logistics-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { isFeatureEnabled } from "@/features/flags/service";
import { getFarmerSummary } from "@/features/agriculture/queries";
import { getSupplierProfile } from "@/features/agriculture/supplier-queries";
import {
  listAgriculturalDeliveries,
  listCollectionCentres,
  listEligibleLogisticsCompanies,
  listIntakes,
  listOperatorIntakes,
  listStorageBookings,
  listStorageFacilities,
} from "@/features/agriculture/logistics-queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agricultural logistics",
  robots: { index: false, follow: false },
};

export default async function AgriculturalLogisticsPage() {
  const actor = await requireActor("/agriculture/logistics");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [farmer, supplier] = await Promise.all([
    getFarmerSummary(actor.id),
    getSupplierProfile(actor.id),
  ]);
  const [companies, centres, facilities] = await Promise.all([
    listEligibleLogisticsCompanies(),
    listCollectionCentres(),
    listStorageFacilities(),
  ]);
  const deliveries = farmer ? await listAgriculturalDeliveries(farmer.id) : [];
  const farmerIntakes = farmer ? await listIntakes({ farmerId: farmer.id }) : [];
  const operatorIntakes = farmer ? await listOperatorIntakes(farmer.id) : [];
  const bookings = farmer ? await listStorageBookings({ farmerId: farmer.id }) : [];
  const supplierBookings = supplier
    ? await listStorageBookings({ facilitySupplierId: supplier.id })
    : [];

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Agricultural logistics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Farm pickup and bulk haulage use the shared delivery engine. Collection centres record
          weighing, grading and rejected quantities; storage capacity is checked before it is held.
        </p>
        <Link href="/agriculture/farmer" className="text-xs text-accent underline">
          Back to farmer portal
        </Link>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      {farmer ? <CentreForm /> : null}
      {supplier && supplier.verificationStatus === "VERIFIED" ? <StorageFacilityForm /> : null}

      {farmer && companies.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Request farm collection</h2>
          <div className="mt-4">
            <AgriculturalDeliveryForm
              companies={companies}
              centres={centres.map((centre) => ({ id: centre.id, name: centre.name }))}
              facilities={facilities.map((facility) => ({ id: facility.id, name: facility.name }))}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Deliveries</h2>
        {deliveries.map((delivery) => (
          <p key={delivery.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            {delivery.requestNumber} · {delivery.cargoType} · {delivery.direction} ·{" "}
            {delivery.quantity} {delivery.unit}
            <span className="block text-xs text-muted-foreground">
              Request {delivery.requestStatus} · job {delivery.jobStatus ?? "not assigned"}
              {delivery.driverName ? ` · driver ${delivery.driverName}` : ""}
            </span>
          </p>
        ))}
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agricultural deliveries yet.</p>
        ) : null}
      </section>

      {farmer && centres.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Collection centre intake</h2>
          <div className="mt-4">
            <IntakeForm centres={centres.map((centre) => ({ id: centre.id, name: centre.name }))} />
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Intake records</h2>
        {[...farmerIntakes, ...operatorIntakes].map((intake) => (
          <div key={intake.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            <p>
              {intake.centreName} · {intake.farmerName} · weighed {intake.weighedKg} kg · rejected{" "}
              {intake.rejectedKg} kg · {intake.status}
            </p>
            <IntakeDecisionForm intakeId={intake.id} status={intake.status} />
          </div>
        ))}
        {farmerIntakes.length === 0 && operatorIntakes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No intake records.</p>
        ) : null}
      </section>

      {farmer && facilities.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Storage</h2>
          <div className="mt-4">
            <StorageBookingForm
              facilities={facilities.map((facility) => ({ id: facility.id, name: facility.name }))}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Storage bookings</h2>
        {[...bookings, ...supplierBookings].map((booking) => (
          <div key={booking.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            <p>
              {booking.facilityName} · {booking.quantityKg} kg · {booking.status}
            </p>
            <StorageDecisionForm bookingId={booking.id} status={booking.status} />
          </div>
        ))}
        {bookings.length === 0 && supplierBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No storage bookings.</p>
        ) : null}
      </section>
    </PageShell>
  );
}
