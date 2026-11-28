import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ConsolePageHeader, ConsoleSection } from "@/components/console/console-ui";
import { CompanyRequestForm, DispatchForm } from "@/components/logistics/dispatch-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import {
  listCompanyRequests,
  listDispatchDrivers,
} from "@/features/logistics-company-dispatch/queries";
import { listContracts } from "@/features/logistics-contracts/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company dispatch",
  robots: { index: false, follow: false },
};

export default function CompanyDispatchPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyDispatchContent params={params} />
    </Suspense>
  );
}

async function CompanyDispatchContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.dispatch.manage",
    companyId,
    `/logistics/${companyId}/dispatch`,
  );
  const [company, requests, drivers, contracts] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyRequests(companyId),
    listDispatchDrivers(companyId),
    listContracts(companyId),
  ]);
  if (!company) notFound();

  const waiting = requests.filter((request) => !request.activeJobId).length;

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Operations"
        title="Dispatch"
        description="Company-originated requests use the platform delivery lifecycle, OTP and proof flow."
        actions={
          <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            {waiting} awaiting courier · {drivers.length} drivers
          </p>
        }
      />

      <ConsoleSection
        title="Available drivers"
        description="A driver must be active, have a vehicle, and be within the configured service area."
      >
        <ul className="flex flex-wrap gap-2">
          {drivers.map((driver) => (
            <li
              key={driver.id}
              className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
            >
              <span className="font-medium text-foreground">{driver.name}</span> ·{" "}
              {driver.vehiclePlate ?? "no vehicle"} · {driver.activeJobs} active job(s)
            </li>
          ))}
          {drivers.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              No active drivers. Register a driver before dispatching.
            </li>
          ) : null}
        </ul>
      </ConsoleSection>

      <ConsoleSection
        title="Delivery requests"
        description="Newest first. Dispatch a request to the best available courier."
        action={<Badge tone="neutral">{requests.length} requests</Badge>}
      >
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No requests yet. Create the first one below.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{request.requestNumber}</p>
                  <p className="text-sm">
                    {request.pickupName} → {request.dropoffName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.distanceKm} km · {request.fee} {request.currency}
                    {request.contractNumber ? ` · ${request.contractNumber}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={request.status === "COMPLETED" ? "success" : "neutral"}>
                    {request.status}
                  </Badge>
                  {request.status === "PENDING" && !request.activeJobId ? (
                    <DispatchForm companyId={companyId} request={request} />
                  ) : null}
                  {request.activeJobId ? (
                    <Link
                      href={`/logistics/${companyId}/jobs`}
                      className="text-sm text-accent hover:underline"
                    >
                      View job →
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </ConsoleSection>

      <ConsoleSection
        title="New delivery request"
        description="Pickup, drop-off and the commercial terms for this run."
        className="max-w-3xl"
      >
        <CompanyRequestForm companyId={companyId} contracts={contracts} />
      </ConsoleSection>
    </div>
  );
}
