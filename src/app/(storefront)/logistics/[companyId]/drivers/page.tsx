import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { DriverForm, MembershipStatusForm } from "@/components/logistics/driver-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/console/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { listDriverMemberships } from "@/features/logistics-drivers/queries";
import { MEMBERSHIP_STATUS_LABELS } from "@/features/logistics-drivers/status";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company drivers",
  robots: { index: false, follow: false },
};

export default function CompanyDriversPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyDriversContent params={params} />
    </Suspense>
  );
}

async function CompanyDriversContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.driver.view",
    companyId,
    `/logistics/${companyId}/drivers`,
  );
  const [company, drivers] = await Promise.all([
    getLogisticsCompany(companyId),
    listDriverMemberships(companyId),
  ]);
  if (!company) notFound();
  const canManage =
    access.permissions.has("*") || access.permissions.has("logistics.driver.manage");

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Drivers"
        description="Driver identity is independent of company membership."
      />

      {drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drivers registered for this company.</p>
      ) : (
        <ul className="space-y-3">
          {drivers.map((driver) => (
            <li
              key={driver.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <Link
                  href={`/logistics/${companyId}/drivers/${driver.id}`}
                  className="font-medium hover:underline"
                >
                  {driver.driverName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {driver.phone || "—"} · {driver.licenseNumber || "No license on file"} ·{" "}
                  {driver.activeVehicles} vehicle(s) · {driver.shifts} shift(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={driver.status === "ACTIVE" ? "success" : "neutral"}>
                  {MEMBERSHIP_STATUS_LABELS[driver.status]}
                </Badge>
                {canManage ? (
                  <MembershipStatusForm
                    companyId={companyId}
                    membershipId={driver.id}
                    status={driver.status}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <section className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Add a driver</h2>
          <div className="mt-4">
            <DriverForm companyId={companyId} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
