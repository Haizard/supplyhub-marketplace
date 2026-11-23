import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  DocumentForm,
  DocumentReviewForm,
  FleetForm,
  MaintenanceForm,
  VehicleForm,
  VehicleStatusForm,
} from "@/components/logistics/fleet-forms";
import { CompanyNav } from "@/components/logistics/company-nav";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listFleets,
  listMaintenance,
  listVehicleDocuments,
  listVehicles,
} from "@/features/logistics-fleet/queries";
import { VEHICLE_STATUS_LABELS } from "@/features/logistics-fleet/status";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company fleet",
  robots: { index: false, follow: false },
};

export default function CompanyFleetPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyFleetContent params={params} />
    </Suspense>
  );
}

async function CompanyFleetContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.fleet.manage",
    companyId,
    `/logistics/${companyId}/fleet`,
  );
  const [company, fleets, vehicles, documents, maintenance] = await Promise.all([
    getLogisticsCompany(companyId),
    listFleets(companyId),
    listVehicles(companyId),
    listVehicleDocuments(companyId),
    listMaintenance(companyId),
  ]);
  if (!company) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <Link
        href={`/logistics/${companyId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {company.name}
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight">Fleet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vehicles, documents and maintenance for this company only.
        </p>
      </header>
      <CompanyNav companyId={companyId} active="fleet" />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Fleets</h2>
        <div className="mt-3 space-y-3">
          {fleets.map((fleet) => (
            <p key={fleet.id} className="text-sm">
              {fleet.name} · {fleet.vehicleCount} vehicle(s)
            </p>
          ))}
        </div>
        <div className="mt-4">
          <FleetForm companyId={companyId} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Vehicles</h2>
        <div className="mt-3 space-y-3">
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles registered yet.</p>
          ) : (
            vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-3"
              >
                <div>
                  <p className="font-medium">{vehicle.plate}</p>
                  <p className="text-xs text-muted-foreground">
                    {vehicle.type} · {vehicle.ownership} · {vehicle.documentCount} document(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={vehicle.status === "ACTIVE" ? "success" : "neutral"}>
                    {VEHICLE_STATUS_LABELS[vehicle.status]}
                  </Badge>
                  <VehicleStatusForm companyId={companyId} vehicle={vehicle} />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <VehicleForm companyId={companyId} fleets={fleets} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Documents</h2>
        <div className="mt-3 space-y-2">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-2 text-sm"
            >
              <span>
                {document.type} · {document.reference || document.storageKey}
              </span>
              <div className="flex items-center gap-3">
                <Badge tone={document.status === "APPROVED" ? "success" : "neutral"}>
                  {document.status}
                </Badge>
                {document.status === "PENDING" ? (
                  <DocumentReviewForm companyId={companyId} document={document} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <DocumentForm companyId={companyId} vehicles={vehicles} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Maintenance</h2>
        <div className="mt-3 space-y-2">
          {maintenance.map((entry) => (
            <p key={entry.id} className="text-sm text-muted-foreground">
              {new Date(entry.performedAt).toLocaleDateString()} · {entry.cost} {entry.currency} ·{" "}
              {entry.description}
            </p>
          ))}
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <MaintenanceForm companyId={companyId} vehicles={vehicles} />
        </div>
      </section>
    </PageShell>
  );
}
