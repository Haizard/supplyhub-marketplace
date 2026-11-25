import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import { CompanyRequestForm, DispatchForm } from "@/components/logistics/dispatch-forms";
import { PageShell } from "@/components/storefront/page-shell";
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

  return (
    <PageShell className="space-y-6 py-8">
      <Link
        href={`/logistics/${companyId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {company.name}
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight">Dispatch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company-originated requests use the platform delivery lifecycle, OTP and proof flow.
        </p>
      </header>
      <CompanyNav companyId={companyId} active="dispatch" />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Available drivers</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A driver must be active, have a vehicle, and be within the configured service area.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {drivers.map((driver) => (
            <li key={driver.id} className="rounded-md border border-border px-3 py-2 text-xs">
              {driver.name} · {driver.vehiclePlate ?? "no vehicle"} · {driver.activeJobs} active
              job(s)
            </li>
          ))}
          {drivers.length === 0 ? (
            <li className="text-sm text-muted-foreground">No active drivers.</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Delivery requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
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
          ))
        )}
      </section>

      <section className="max-w-3xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">New delivery request</h2>
        <div className="mt-4">
          <CompanyRequestForm companyId={companyId} contracts={contracts} />
        </div>
      </section>
    </PageShell>
  );
}
