import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/storefront/page-shell";
import { AgentJobActions, JobStatusBadge, LocationPing } from "@/components/logistics/job-actions";
import { AgentRegistrationForm, PresenceForm } from "@/components/logistics/forms";
import { listAgentJobs, getAgentView, listAgentEarnings } from "@/features/logistics/queries";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { formatDate } from "@/lib/utils/format-date";

export const metadata: Metadata = {
  title: "Courier studio",
  robots: { index: false, follow: false },
};

export default function CourierPage() {
  return (
    <Suspense fallback={<CourierSkeleton />}>
      <CourierContent />
    </Suspense>
  );
}

async function CourierContent() {
  const actor = await getSessionActor();

  if (!actor) {
    return (
      <PageShell className="py-10">
        <EmptyState
          title="Sign in to see your courier studio."
          description="Couriers sign in with their SupplyHub account to view and update deliveries."
        />
      </PageShell>
    );
  }

  const database = getDatabase();
  const agentRow = await database.deliveryAgent.findFirst({
    where: { userId: actor.id },
    select: { id: true },
  });

  if (!agentRow) {
    return (
      <PageShell className="space-y-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Courier studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register as a courier to receive deliveries from the marketplace and its businesses.
          </p>
        </header>
        <AgentRegistrationForm />
      </PageShell>
    );
  }

  const [agent, jobs, earnings] = await Promise.all([
    getAgentView(agentRow.id),
    listAgentJobs(agentRow.id),
    listAgentEarnings(agentRow.id),
  ]);

  if (!agent) return null;

  return (
    <PageShell className="space-y-8 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courier studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {agent.name} · {agent.agentCode} · {agent.completedTrips} completed trips · Rating{" "}
            {agent.rating}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verification: {agent.verification.toLowerCase()} ·{" "}
            {agent.vehicle ? `${agent.vehicle.type} ${agent.vehicle.plate}` : "No vehicle on file"}
          </p>
        </div>
        <div className="space-y-2">
          <Badge tone={agent.presence === "ONLINE" ? "success" : "neutral"}>{agent.presence}</Badge>
          {agent.verification === "APPROVED" ? (
            <PresenceForm presence={agent.presence} />
          ) : (
            <p className="text-xs text-muted-foreground">Awaiting administrator approval.</p>
          )}
        </div>
      </header>

      <section aria-labelledby="my-jobs-heading" className="space-y-4">
        <h2 id="my-jobs-heading" className="text-lg font-medium">
          My deliveries
        </h2>
        {jobs.length === 0 ? (
          <EmptyState
            title="No deliveries assigned."
            description="Once an administrator dispatches a job to you, its tracking and actions will appear here."
          />
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => {
              const active = ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"].includes(
                job.status,
              );
              const canVerifyOtp = job.status === "AT_PICKUP" || job.status === "TRANSIT";
              return (
                <li key={job.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-mono text-sm font-medium">{job.jobNumber}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {job.pickupAddress} → {job.dropoffAddress}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.distanceKm} km · {job.fee} {job.currency} · assigned{" "}
                        {formatDate(job.assignedAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <JobStatusBadge status={job.status} />
                      <Link
                        href={`/delivery/track/${job.id}`}
                        className="text-xs underline underline-offset-2"
                      >
                        Open live tracking
                      </Link>
                    </div>
                  </div>

                  {active ? (
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <LocationPing jobId={job.id} />
                      {job.latestLocation ? (
                        <p className="text-xs text-muted-foreground">
                          Last ping: {job.latestLocation.latitude}, {job.latestLocation.longitude}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {active ? (
                    <div className="mt-4">
                      <AgentJobActions
                        jobId={job.id}
                        status={job.status}
                        canVerifyOtp={canVerifyOtp}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="earnings-heading" className="space-y-3">
        <h2 id="earnings-heading" className="text-lg font-medium">
          My earnings
        </h2>
        {earnings.length === 0 ? (
          <EmptyState
            title="No earnings yet."
            description="Completed deliveries will appear here."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {earnings.map((earning) => (
              <li key={earning.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono text-sm">{earning.jobNumber}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(earning.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {earning.amount} {earning.currency}
                  </span>
                  <Badge tone={earning.status === "PAID" ? "success" : "clay"}>
                    {earning.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function CourierSkeleton() {
  return (
    <PageShell className="space-y-6 py-8" role="status" aria-label="Loading courier studio">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </PageShell>
  );
}
