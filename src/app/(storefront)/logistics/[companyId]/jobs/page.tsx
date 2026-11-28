import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  CompanyJobStatusForm,
  CompanyOtpForm,
  ReassignForm,
} from "@/components/logistics/dispatch-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/console/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import {
  listCompanyJobs,
  listDispatchDrivers,
} from "@/features/logistics-company-dispatch/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company deliveries",
  robots: { index: false, follow: false },
};

export default function CompanyJobsPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyJobsContent params={params} />
    </Suspense>
  );
}

async function CompanyJobsContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.dispatch.manage",
    companyId,
    `/logistics/${companyId}/jobs`,
  );
  const [company, jobs, drivers] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyJobs(companyId),
    listDispatchDrivers(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Deliveries"
        description="Jobs follow the shared state machine with OTP hand-over and proof of delivery."
      />

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No company delivery jobs yet.</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id} className="space-y-3 rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-medium">{job.jobNumber}</p>
                  <p className="text-sm">
                    {job.pickupName} → {job.dropoffName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.driverName ?? "Unassigned"} · {job.vehiclePlate ?? "no vehicle"}
                    {job.contractNumber ? ` · ${job.contractNumber}` : ""}
                  </p>
                </div>
                <Badge tone={job.status === "DELIVERED" ? "success" : "neutral"}>
                  {job.status}
                </Badge>
              </div>

              {["AT_PICKUP", "TRANSIT"].includes(job.status) ? (
                <CompanyOtpForm companyId={companyId} jobId={job.id} />
              ) : null}
              <CompanyJobStatusForm companyId={companyId} job={job} />
              {["ASSIGNED", "ACCEPTED", "TO_PICKUP"].includes(job.status) ? (
                <ReassignForm companyId={companyId} job={job} drivers={drivers} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
