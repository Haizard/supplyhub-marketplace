import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeliveryRequestForm } from "@/components/logistics/delivery-request-form";
import { listRequests, listCustomerJobs } from "@/features/logistics/queries";
import { getSessionActor } from "@/server/auth/session";
import { formatDate } from "@/lib/utils/format-date";
import { RequesterJobActions, JobStatusBadge } from "@/components/logistics/job-actions";

export const metadata: Metadata = {
  title: "Request a delivery",
  robots: { index: false, follow: false },
};

export default function RequestDeliveryPage() {
  return (
    <Suspense fallback={<RequestSkeleton />}>
      <RequestContent />
    </Suspense>
  );
}

async function RequestContent() {
  const actor = await getSessionActor();

  if (!actor) {
    return (
      <PageShell className="py-10">
        <EmptyState
          title="Sign in to request a delivery."
          description="Delivery requests are tied to your SupplyHub account so you can track them securely."
        />
      </PageShell>
    );
  }

  const [requests, jobs] = await Promise.all([listRequests(actor.id), listCustomerJobs(actor.id)]);

  return (
    <PageShell className="space-y-8 py-8">
      <header>
        <p className="eyebrow text-muted-foreground">Shared logistics</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] sm:text-5xl">
          Request a delivery
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Give a pickup and drop-off point. The marketplace calculates a distance-based fee using
          its documented default pricing rule, then dispatches a verified courier when one is
          available.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <DeliveryRequestForm />

        <aside className="space-y-6">
          <section aria-labelledby="my-requests-heading">
            <h2 id="my-requests-heading" className="text-lg font-medium">
              My requests
            </h2>
            {requests.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No delivery requests yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {requests.map((request) => (
                  <li key={request.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs font-medium">{request.requestNumber}</p>
                      <Badge tone={request.status === "CANCELLED" ? "danger" : "neutral"}>
                        {request.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {request.dropoffAddress} · {request.fee} {request.currency} ·{" "}
                      {formatDate(request.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="my-jobs-heading">
            <h2 id="my-jobs-heading" className="text-lg font-medium">
              My jobs
            </h2>
            {jobs.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No courier jobs yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {jobs.map((job) => (
                  <li key={job.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/delivery/track/${job.id}`}
                        className="font-mono text-xs font-medium underline underline-offset-2"
                      >
                        {job.jobNumber}
                      </Link>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.pickupName} → {job.dropoffName}
                    </p>
                    {job.otpCode ? (
                      <p className="mt-2 rounded-md bg-surface-muted p-2 font-mono text-sm">
                        Hand-over code: {job.otpCode}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <RequesterJobActions jobId={job.id} status={job.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

function RequestSkeleton() {
  return (
    <PageShell className="space-y-6 py-8" role="status" aria-label="Loading delivery requests">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </PageShell>
  );
}
