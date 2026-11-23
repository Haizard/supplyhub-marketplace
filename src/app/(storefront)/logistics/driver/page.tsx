import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listActorDriverMemberships, getDriverDetail } from "@/features/logistics-drivers/queries";
import { MEMBERSHIP_STATUS_LABELS } from "@/features/logistics-drivers/status";
import { requireDriverContext } from "@/server/logistics/driver-access";
import { getSessionActor } from "@/server/auth/session";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Driver workspace",
  robots: { index: false, follow: false },
};

export default function DriverWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <DriverWorkspaceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DriverWorkspaceContent({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const actor = await getSessionActor();
  if (!actor) notFound();

  if (company && uuidSchema.safeParse(company).success) {
    const context = await requireDriverContext(company);
    const detail = await getDriverDetail(context.membershipId, context.companyId);
    if (!detail) notFound();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    return (
      <PageShell className="space-y-6 py-8">
        <Link
          href="/logistics/driver"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Driver workspace
        </Link>
        <header>
          <h1 className="font-display text-3xl tracking-tight">My assignments</h1>
          <p className="text-sm text-muted-foreground">
            {days
              .filter((_, index) => detail.schedules.some((s) => s.dayOfWeek === index))
              .join(", ") || "No scheduled shifts"}
          </p>
        </header>
        <ul className="space-y-2">
          {detail.assignments
            .filter((a) => a.status === "ACTIVE")
            .map((assignment) => (
              <li key={assignment.id} className="rounded-xl border border-border bg-surface p-5">
                <p className="font-medium">{assignment.plate}</p>
                <p className="text-xs text-muted-foreground">{assignment.vehicleType} · assigned</p>
              </li>
            ))}
          {detail.assignments.filter((a) => a.status === "ACTIVE").length === 0 ? (
            <li className="text-sm text-muted-foreground">No active vehicle assignment.</li>
          ) : null}
        </ul>
      </PageShell>
    );
  }

  const memberships = await listActorDriverMemberships(actor.id);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Driver workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your company memberships, shifts and assigned vehicles.
        </p>
      </header>

      {memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You are not registered as a driver with any logistics company yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {memberships.map((membership) => (
            <li
              key={membership.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <Link
                  href={`/logistics/driver?company=${membership.companyId}`}
                  className="font-medium hover:underline"
                >
                  {membership.companyName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {membership.vehicles.map((vehicle) => vehicle.plate).join(", ") ||
                    "No vehicle assigned"}
                </p>
              </div>
              <Badge tone={membership.status === "ACTIVE" ? "success" : "neutral"}>
                {MEMBERSHIP_STATUS_LABELS[membership.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
