import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ReconciliationRunButton } from "@/components/admin/reconciliation-run-button";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listRecentReconciliationRuns } from "@/features/reconciliation/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Payment reconciliation",
  robots: { index: false, follow: false },
};

export default function AdminReconciliationPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AdminReconciliationContent />
    </Suspense>
  );
}

async function AdminReconciliationContent() {
  await requireAdmin();
  const runs = await listRecentReconciliationRuns();

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Payment reconciliation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare completed payments with the commission ledger and refund reversals.
          </p>
        </div>
        <ReconciliationRunButton />
      </header>

      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Run reconciliation to check payments against the ledger."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/admin/reconciliation/${run.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {run.runNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {new Date(run.createdAt).toLocaleString()} · {run.checkedCount} checked
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={run.findingCount === 0 ? "success" : "neutral"}>
                  {run.findingCount} finding(s)
                </Badge>
                <span className="text-xs text-muted-foreground">{run.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
