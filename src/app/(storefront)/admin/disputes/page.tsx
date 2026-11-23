import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllDisputes } from "@/features/disputes/queries";
import { DISPUTE_STATUS_LABELS } from "@/features/disputes/status";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Dispute centre",
  robots: { index: false, follow: false },
};

export default function AdminDisputesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AdminDisputesContent />
    </Suspense>
  );
}

async function AdminDisputesContent() {
  await requireAdmin();
  const disputes = await listAllDisputes();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Dispute centre</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Triage buyer disputes and record decisions.
        </p>
      </header>

      {disputes.length === 0 ? (
        <EmptyState title="No disputes" description="Buyer disputes will appear here." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {disputes.map((dispute) => (
            <li key={dispute.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/admin/disputes/${dispute.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {dispute.disputeNumber}
                </Link>
                <p className="text-sm">{dispute.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {dispute.buyerName} · {dispute.vendorName} · Order {dispute.orderNumber}
                </p>
              </div>
              <Badge tone={dispute.status === "RESOLVED" ? "success" : "neutral"}>
                {DISPUTE_STATUS_LABELS[dispute.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
