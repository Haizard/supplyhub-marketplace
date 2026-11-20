import type { Metadata } from "next";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/storefront/page-shell";
import { DispatchForm } from "@/components/logistics/forms";
import { JobStatusBadge } from "@/components/logistics/job-actions";
import { requireAdmin } from "@/server/auth/guards";
import {
  listAgentDocuments,
  listAllEarnings,
  listPendingAgents,
  listPricingRules,
  listRequests,
} from "@/features/logistics/queries";
import { getDatabase } from "@/server/db/client";
import { formatDate } from "@/lib/utils/format-date";

export const metadata: Metadata = {
  title: "Delivery operations",
  robots: { index: false, follow: false },
};

export default function AdminDeliveryPage() {
  return (
    <Suspense fallback={<DeliverySkeleton />}>
      <AdminDeliveryContent />
    </Suspense>
  );
}

async function AdminDeliveryContent() {
  await requireAdmin();

  const [requests, pendingAgents, documents, earnings, pricing] = await Promise.all([
    listRequests(),
    listPendingAgents(),
    listAgentDocuments(),
    listAllEarnings(),
    listPricingRules(),
  ]);

  const jobs = await getDatabase().deliveryJob.findMany({
    orderBy: { assignedAt: "desc" },
    take: 50,
    select: {
      id: true,
      jobNumber: true,
      status: true,
      agent: { select: { name: true } },
      request: { select: { requestNumber: true, dropoffAddress: true } },
    },
  });

  const pendingDocs = documents.filter((doc) => doc.status === "PENDING");
  const unpaid = earnings.filter((earning) => earning.status === "PENDING");

  return (
    <PageShell className="space-y-8 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Delivery operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review courier applications, dispatch pending requests, and reconcile courier earnings.
        </p>
      </header>

      <section aria-labelledby="dispatch-heading" className="space-y-3">
        <h2 id="dispatch-heading" className="text-lg font-medium">
          Pending dispatch
        </h2>
        {requests.filter((r) => r.status === "PENDING").length === 0 ? (
          <EmptyState
            title="No pending requests."
            description="New delivery requests will appear here."
          />
        ) : (
          <ul className="space-y-3">
            {requests
              .filter((r) => r.status === "PENDING")
              .map((request) => (
                <li key={request.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-medium">{request.requestNumber}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.pickupAddress} → {request.dropoffAddress} · {request.distanceKm} km
                        · {request.fee} {request.currency}
                      </p>
                    </div>
                    <DispatchForm requestId={request.id} />
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="jobs-heading" className="space-y-3">
        <h2 id="jobs-heading" className="text-lg font-medium">
          Active and recent jobs
        </h2>
        {jobs.length === 0 ? (
          <EmptyState title="No jobs yet." description="Dispatched jobs will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono text-sm font-medium">{job.jobNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.request.requestNumber} · {job.agent?.name ?? "Unassigned"} ·{" "}
                    {job.request.dropoffAddress}
                  </p>
                </div>
                <JobStatusBadge status={job.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="agents-heading" className="space-y-3">
        <h2 id="agents-heading" className="text-lg font-medium">
          Courier applications
        </h2>
        {pendingAgents.length === 0 ? (
          <EmptyState
            title="No pending applications."
            description="New courier profiles will appear here."
          />
        ) : (
          <ul className="space-y-3">
            {pendingAgents.map((agent) => (
              <li key={agent.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="font-medium">{agent.name}</p>
                <p className="text-xs text-muted-foreground">
                  {agent.agentCode} · {agent.phone} · {agent.activeJobs} active jobs
                </p>
              </li>
            ))}
          </ul>
        )}
        {pendingDocs.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {pendingDocs.length} document(s) awaiting review across all couriers.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="earnings-heading" className="space-y-3">
        <h2 id="earnings-heading" className="text-lg font-medium">
          Courier earnings
        </h2>
        {unpaid.length === 0 ? (
          <EmptyState
            title="Nothing to reconcile."
            description="Paid and pending courier earnings appear here."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {unpaid.map((earning) => (
              <li key={earning.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{earning.agentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {earning.jobNumber} · {formatDate(earning.createdAt)}
                  </p>
                </div>
                <Badge tone="clay">
                  {earning.amount} {earning.currency}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pricing-heading">
        <h2 id="pricing-heading" className="text-lg font-medium">
          Delivery pricing
        </h2>
        {pricing.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No explicit rule — using the documented default.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {pricing.map((rule) => (
              <li key={rule.id} className="rounded-lg border border-border bg-surface p-3">
                {rule.currency}: base {rule.baseFee.toString()} + {rule.perKmRate.toString()}/km ·
                min {rule.minimumFee.toString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function DeliverySkeleton() {
  return (
    <PageShell className="space-y-6 py-8" role="status" aria-label="Loading delivery operations">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </PageShell>
  );
}
