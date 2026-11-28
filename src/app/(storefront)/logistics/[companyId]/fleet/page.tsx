import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ConsolePageHeader, ConsoleSection } from "@/components/logistics/console-ui";
import {
  DocumentForm,
  DocumentReviewForm,
  FleetForm,
  MaintenanceForm,
  VehicleForm,
  VehicleStatusForm,
} from "@/components/logistics/fleet-forms";
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

  const inService = vehicles.filter((vehicle) => vehicle.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Fleet"
        title="Vehicles and documents"
        description="Register the vehicles you dispatch with, keep their papers approved, and record maintenance before a job is blocked."
        actions={
          <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            {inService} of {vehicles.length} in service
          </p>
        }
      />

      <ConsoleSection
        title="Fleets"
        description="Group vehicles by depot, branch or contract."
        action={<Badge tone="neutral">{fleets.length} fleets</Badge>}
      >
        <div className="space-y-3">
          {fleets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fleets yet. Create the first one below, then add vehicles to it.
            </p>
          ) : (
            fleets.map((fleet) => (
              <p key={fleet.id} className="text-sm">
                <span className="font-medium">{fleet.name}</span>
                <span className="text-muted-foreground"> · {fleet.vehicleCount} vehicle(s)</span>
              </p>
            ))
          )}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <FleetForm companyId={companyId} />
        </div>
      </ConsoleSection>

      <ConsoleSection
        title="Vehicles"
        description="A vehicle needs to be active before dispatch can assign it."
        action={<Badge tone="neutral">{vehicles.length} registered</Badge>}
      >
        <div className="space-y-1">
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles registered yet.</p>
          ) : (
            vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0"
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
        <div className="mt-4 border-t border-border pt-4">
          <VehicleForm companyId={companyId} fleets={fleets} />
        </div>
      </ConsoleSection>

      <ConsoleSection
        title="Documents"
        description="Registration, insurance and inspection papers. Pending documents are reviewed here."
      >
        <div className="space-y-1">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicle documents uploaded.</p>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-b-0"
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
            ))
          )}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <DocumentForm companyId={companyId} vehicles={vehicles} />
        </div>
      </ConsoleSection>

      <ConsoleSection
        title="Maintenance"
        description="Keep the service history that explains why a vehicle is off the road."
      >
        <div className="space-y-1">
          {maintenance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance recorded.</p>
          ) : (
            maintenance.map((entry) => (
              <p key={entry.id} className="text-sm text-muted-foreground">
                {new Date(entry.performedAt).toLocaleDateString()} · {entry.cost} {entry.currency} ·{" "}
                {entry.description}
              </p>
            ))
          )}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <MaintenanceForm companyId={companyId} vehicles={vehicles} />
        </div>
      </ConsoleSection>
    </div>
  );
}
