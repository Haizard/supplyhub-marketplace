import type { Metadata } from "next";
import { Route, Clock, MapPin, ArrowRight } from "lucide-react";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listActiveCorridors } from "@/features/logistics-regional/queries";

export const metadata: Metadata = {
  title: "Regional Corridors",
  description: "Browse active regional delivery corridors connecting business branches.",
};

export default function CorridorsPage() {
  return (
    <Suspense fallback={<CorridorsSkeleton />}>
      <CorridorsContent />
    </Suspense>
  );
}

async function CorridorsContent() {
  const enabled = await isFeatureEnabled("phase7.regionalLogistics");

  if (!enabled) {
    return (
      <PageShell className="pt-10 sm:pt-14">
        <div className="border-b border-border pb-8">
          <p className="eyebrow text-muted-foreground">Logistics</p>
          <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
            Regional Corridors.
          </h1>
        </div>
        <EmptyState
          icon={<Route className="size-5" aria-hidden="true" />}
          title="Coming soon."
          description="Regional logistics corridors are being prepared. Check back shortly."
          className="mt-8"
        />
      </PageShell>
    );
  }

  const corridors = await listActiveCorridors();

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">Logistics</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          Regional Corridors.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          Active delivery corridors connecting business branches across the region. Each corridor
          lists its route, estimated transit time, and base fee.
        </p>
      </div>

      {corridors.length === 0 ? (
        <EmptyState
          icon={<Route className="size-5" aria-hidden="true" />}
          title="No active corridors."
          description="There are no active regional corridors to browse yet."
          className="mt-8"
        />
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
          {corridors.map((corridor) => (
            <li key={corridor.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-medium tracking-[-0.02em]">
                    {corridor.name}
                  </h2>
                  <p className="mt-1 font-mono text-[0.6875rem] tracking-[0.1em] text-muted-foreground">
                    {corridor.corridorCode}
                  </p>
                  {corridor.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{corridor.description}</p>
                  ) : null}
                </div>
                <dl className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <dt className="eyebrow flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3" aria-hidden="true" /> Route
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 font-medium">
                      {corridor.originBranchName}
                      <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {corridor.destBranchName}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow flex items-center gap-1 text-muted-foreground">
                      <Route className="size-3" aria-hidden="true" /> Distance
                    </dt>
                    <dd className="mt-1 font-medium">{corridor.estimatedKm} km</dd>
                  </div>
                  <div>
                    <dt className="eyebrow flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3" aria-hidden="true" /> Est. time
                    </dt>
                    <dd className="mt-1 font-medium">{corridor.estimatedHours} h</dd>
                  </div>
                  <div>
                    <dt className="eyebrow text-muted-foreground">Base fee</dt>
                    <dd className="mt-1 font-medium">
                      {corridor.baseFee} {corridor.currency}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow text-muted-foreground">Per km</dt>
                    <dd className="mt-1 font-medium">
                      {corridor.perKmFee} {corridor.currency}
                    </dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function CorridorsSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading corridors">
        <div className="border-b border-border pb-8">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-12 w-72 max-w-full" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        </div>
        <div className="mt-8 space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
