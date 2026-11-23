import type { Metadata } from "next";
import { Plus, Route } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listAllCorridors } from "@/features/logistics-regional/queries";
import { CORRIDOR_STATUS_LABELS } from "@/features/logistics-regional/status";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Regional Corridors",
  description: "Manage regional delivery corridors.",
  robots: { index: false, follow: false },
};

function statusTone(status: string): "neutral" | "success" | "accent" {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "neutral";
  return "accent";
}

export default function AdminCorridorsPage() {
  return (
    <Suspense fallback={<AdminCorridorsSkeleton />}>
      <AdminCorridorsContent />
    </Suspense>
  );
}

async function AdminCorridorsContent() {
  const [admin, enabled, corridors] = await Promise.all([
    requireAdmin(),
    isFeatureEnabled("phase7.regionalLogistics"),
    listAllCorridors(),
  ]);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow text-muted-foreground">Administration</p>
          <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
            Regional Corridors.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Manage delivery corridors that connect business branches. Create a corridor, add
            intermediate stops, then activate it to make it publicly browsable.
          </p>
          <p className="mt-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            Signed in as {admin.name}
          </p>
        </div>

        <Link
          href="/admin/corridors/new"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden="true" />
          New corridor
        </Link>
      </div>

      {!enabled ? (
        <div className="mt-8 rounded-xl border border-dashed border-border-strong/70 bg-surface/60 px-6 py-8 text-sm text-muted-foreground">
          The regional logistics feature flag is disabled. Corridors can be created but will not
          appear on the storefront until enabled.
        </div>
      ) : null}

      {corridors.length === 0 ? (
        <EmptyState
          icon={<Route className="size-5" aria-hidden="true" />}
          title="No corridors yet."
          description="Create a corridor to connect business branches with a delivery route."
          className="mt-8"
        >
          <Link
            href="/admin/corridors/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden="true" />
            Create the first corridor
          </Link>
        </EmptyState>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
          {corridors.map((corridor) => (
            <li key={corridor.id}>
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-xl font-medium tracking-[-0.02em]">
                      {corridor.name}
                    </h2>
                    <Badge tone={statusTone(corridor.status)}>
                      {CORRIDOR_STATUS_LABELS[corridor.status as "DRAFT" | "ACTIVE" | "INACTIVE"]}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-[0.6875rem] tracking-[0.1em] text-muted-foreground">
                    {corridor.corridorCode}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {corridor.originBranchName} → {corridor.destBranchName}
                    {" · "}
                    {corridor.estimatedKm} km · {corridor.estimatedHours} h{" · "}
                    {corridor.stopCount} stop{corridor.stopCount === 1 ? "" : "s"}
                  </p>
                </div>

                <Link
                  href={`/admin/corridors/${corridor.id}`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Manage
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function AdminCorridorsSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading corridors">
        <div className="border-b border-border pb-8">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-12 w-72 max-w-full" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        </div>
        <div className="mt-8 space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
