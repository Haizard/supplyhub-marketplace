import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import {
  AssignVehicleForm,
  EmploymentForm,
  ReleaseVehicleForm,
  ScheduleForm,
} from "@/components/logistics/driver-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { getDriverDetail } from "@/features/logistics-drivers/queries";
import { MEMBERSHIP_STATUS_LABELS } from "@/features/logistics-drivers/status";
import { listVehicles } from "@/features/logistics-fleet/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Driver details",
  robots: { index: false, follow: false },
};

export default function DriverDetailPage({
  params,
}: {
  params: Promise<{ companyId: string; membershipId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <DriverDetailContent params={params} />
    </Suspense>
  );
}

async function DriverDetailContent({
  params,
}: {
  params: Promise<{ companyId: string; membershipId: string }>;
}) {
  const { companyId, membershipId } = await params;
  if (!uuidSchema.safeParse(companyId).success || !uuidSchema.safeParse(membershipId).success) {
    notFound();
  }
  const access = await requireLogisticsAccess(
    "logistics.driver.view",
    companyId,
    `/logistics/${companyId}/drivers`,
  );
  const [company, detail, vehicles] = await Promise.all([
    getLogisticsCompany(companyId),
    getDriverDetail(membershipId, companyId),
    listVehicles(companyId),
  ]);
  if (!company || !detail) notFound();
  const canManage =
    access.permissions.has("*") || access.permissions.has("logistics.driver.manage");

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <PageShell className="space-y-6 py-8">
      <Link
        href={`/logistics/${companyId}/drivers`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Drivers
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{detail.driverName}</h1>
          <p className="text-sm text-muted-foreground">Driver #{detail.driverId.slice(0, 8)}</p>
        </div>
        <Badge tone={detail.status === "ACTIVE" ? "success" : "neutral"}>
          {MEMBERSHIP_STATUS_LABELS[detail.status]}
        </Badge>
      </header>
      <CompanyNav companyId={companyId} active="drivers" />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Compensation agreement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mode: {detail.employment?.mode ?? "Not configured"} · {detail.employment?.type ?? "—"}
        </p>
        <div className="mt-4">
          {canManage ? (
            <EmploymentForm
              companyId={companyId}
              membershipId={membershipId}
              employment={detail.employment}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No agreement configured.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Shifts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.schedules.map((shift) => (
            <li key={shift.id}>
              {days[shift.dayOfWeek]} · {shift.startTime}–{shift.endTime} ·{" "}
              {shift.isAvailable ? "Available" : "Unavailable"}
            </li>
          ))}
          {detail.schedules.length === 0 ? (
            <li className="text-muted-foreground">No shifts added.</li>
          ) : null}
        </ul>
        {canManage ? (
          <div className="mt-4 border-t border-border pt-4">
            <ScheduleForm companyId={companyId} membershipId={membershipId} />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Vehicle assignments</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.assignments.map((assignment) => (
            <li key={assignment.id} className="flex items-center justify-between gap-3">
              <span>
                {assignment.plate} · {assignment.vehicleType} · {assignment.status}
              </span>
              {canManage && assignment.status === "ACTIVE" ? (
                <ReleaseVehicleForm companyId={companyId} assignmentId={assignment.id} />
              ) : null}
            </li>
          ))}
          {detail.assignments.length === 0 ? (
            <li className="text-muted-foreground">No vehicle assigned.</li>
          ) : null}
        </ul>
        {canManage ? (
          <div className="mt-4 border-t border-border pt-4">
            <AssignVehicleForm
              companyId={companyId}
              membershipId={membershipId}
              vehicles={vehicles}
            />
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
