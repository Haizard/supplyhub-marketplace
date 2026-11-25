import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import {
  ParcelHubForm,
  ParcelIntakeForm,
  ParcelReleaseForm,
  ReleaseUsageForm,
  ReserveUsageForm,
  SetShareVehicleForm,
  ShareOfferForm,
  ShareResponseForm,
  ShareStatusForm,
} from "@/components/logistics/sharing-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import {
  listActiveCompanyJobs,
  listParcelHandovers,
  listParcelHubs,
  listShareAgreements,
  listShareableVehicles,
} from "@/features/logistics-sharing/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

/** Module-scope helper keeps impure clock reads out of the render body. */
function eligibleVehicles(
  vehicles: {
    id: string;
    plate: string;
    type: string;
    status: string;
    insuranceExpiresAt: string | null;
  }[],
) {
  const now = Date.now();
  return vehicles.filter(
    (vehicle) =>
      vehicle.status === "ACTIVE" &&
      (vehicle.insuranceExpiresAt === null || new Date(vehicle.insuranceExpiresAt).getTime() > now),
  );
}

export const metadata: Metadata = {
  title: "Fleet sharing and parcel hubs",
  robots: { index: false, follow: false },
};

export default function SharingPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <SharingContent params={params} />
    </Suspense>
  );
}

async function SharingContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.fleet.share",
    companyId,
    `/logistics/${companyId}/sharing`,
  );
  const [company, agreements, vehicles, hubs, handovers, jobs] = await Promise.all([
    getLogisticsCompany(companyId),
    listShareAgreements(companyId),
    listShareableVehicles(companyId),
    listParcelHubs(companyId),
    listParcelHandovers(companyId),
    listActiveCompanyJobs(companyId),
  ]);
  if (!company) notFound();

  const agreementEditableVehicles = eligibleVehicles(vehicles);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Fleet sharing and parcel hubs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capacity is shared only with explicit consent from both companies, current insurance and a
          single accountable company per delivery. Every custody change is recorded.
        </p>
      </header>
      <CompanyNav companyId={companyId} active="sharing" />

      <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Sharing agreements</h2>
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sharing agreements yet.</p>
        ) : null}
        {agreements.map((agreement) => {
          const editable = ["PENDING_PARTNER", "ACTIVE", "SUSPENDED"].includes(agreement.status);
          const availableForAdd = agreementEditableVehicles.filter(
            (vehicle) => !agreement.vehicles.some((link) => link.plate === vehicle.plate),
          );
          return (
            <article key={agreement.id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm">{agreement.agreementNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {agreement.direction === "OWNER" ? "Offered by you to" : "Offered to you by"}{" "}
                    {agreement.counterpartyName} · {agreement.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Insurance: {agreement.insurancePolicyRef ?? "not recorded"} · expires{" "}
                    {agreement.insuranceExpiresAt
                      ? new Date(agreement.insuranceExpiresAt).toLocaleDateString()
                      : "unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Consent: owner {agreement.ownerConsented ? "yes" : "no"} · partner{" "}
                    {agreement.partnerConsented ? "yes" : "no"} · accountable company{" "}
                    {agreement.accountableCompanyId === companyId ? "your company" : "counterparty"}
                  </p>
                </div>
                <Badge tone={agreement.status === "ACTIVE" ? "success" : "neutral"}>
                  {agreement.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {agreement.vehicles.map((vehicle) => (
                  <span
                    key={vehicle.id}
                    className="rounded-md bg-surface-muted px-2 py-1 font-mono"
                  >
                    {vehicle.plate}
                  </span>
                ))}
                {agreement.vehicles.length === 0 ? (
                  <span className="text-muted-foreground">No vehicles shared.</span>
                ) : null}
              </div>

              {agreement.direction === "PARTNER" && agreement.status === "PENDING_PARTNER" ? (
                <ShareResponseForm companyId={companyId} agreementId={agreement.id} />
              ) : null}
              {agreement.status !== "PENDING_PARTNER" ? (
                <ShareStatusForm
                  companyId={companyId}
                  agreementId={agreement.id}
                  status={agreement.status}
                />
              ) : null}

              {editable && agreement.direction === "OWNER" ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  {agreement.vehicles.map((vehicle) => (
                    <SetShareVehicleForm
                      key={vehicle.id}
                      companyId={companyId}
                      agreementId={agreement.id}
                      vehicles={[vehicle]}
                      active={false}
                    />
                  ))}
                  {availableForAdd.length > 0 ? (
                    <SetShareVehicleForm
                      companyId={companyId}
                      agreementId={agreement.id}
                      vehicles={availableForAdd}
                      active
                    />
                  ) : null}
                </div>
              ) : null}

              {agreement.status === "ACTIVE" && agreement.direction === "PARTNER" ? (
                <div className="border-t border-border pt-3">
                  <ReserveUsageForm
                    companyId={companyId}
                    agreementId={agreement.id}
                    vehicles={agreement.vehicles}
                    jobs={jobs}
                  />
                </div>
              ) : null}

              {agreement.openUsages.length > 0 ? (
                <ul className="space-y-2 border-t border-border pt-3 text-xs">
                  {agreement.openUsages.map((usage) => (
                    <li
                      key={usage.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        {usage.vehiclePlate} reserved
                        {usage.jobNumber ? ` for ${usage.jobNumber}` : ""} · accountable:{" "}
                        {usage.accountableCompanyId === companyId ? "your company" : "counterparty"}
                      </span>
                      <ReleaseUsageForm companyId={companyId} usageId={usage.id} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Offer capacity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Available vehicles:{" "}
          {agreementEditableVehicles.map((vehicle) => vehicle.plate).join(", ") || "none"}
        </p>
        <div className="mt-4">
          <ShareOfferForm companyId={companyId} vehicles={agreementEditableVehicles} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Parcel hubs</h2>
        <ul className="space-y-2 text-sm">
          {hubs.map((hub) => (
            <li
              key={hub.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2"
            >
              <span>
                {hub.name} · {hub.hubCode} · {hub.address} · {hub.storedCount}/{hub.capacity}{" "}
                parcels
              </span>
              <Badge tone={hub.status === "ACTIVE" ? "success" : "neutral"}>{hub.status}</Badge>
            </li>
          ))}
          {hubs.length === 0 ? (
            <li className="text-muted-foreground">No hubs registered.</li>
          ) : null}
        </ul>
        <div className="border-t border-border pt-4">
          <ParcelHubForm companyId={companyId} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Parcel custody</h2>
        {hubs.length > 0 ? (
          <ParcelIntakeForm companyId={companyId} hubs={hubs} jobs={jobs} />
        ) : (
          <p className="text-sm text-muted-foreground">Register a hub before recording custody.</p>
        )}
        <ul className="space-y-3 border-t border-border pt-4 text-sm">
          {handovers.map((handover) => (
            <li
              key={handover.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2"
            >
              <span>
                {handover.trackingRef} · {handover.hubName} · {handover.direction} ·{" "}
                {handover.status}
                <span className="block text-xs text-muted-foreground">
                  Received {new Date(handover.receivedAt).toLocaleString()}
                </span>
              </span>
              {handover.status === "STORED" ? (
                <ParcelReleaseForm companyId={companyId} handoverId={handover.id} />
              ) : null}
            </li>
          ))}
          {handovers.length === 0 ? (
            <li className="text-muted-foreground">No parcels in custody.</li>
          ) : null}
        </ul>
      </section>
    </PageShell>
  );
}
