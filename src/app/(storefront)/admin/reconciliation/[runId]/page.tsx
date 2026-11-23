import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getReconciliationRun } from "@/features/reconciliation/queries";
import { requireAdmin } from "@/server/auth/guards";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Reconciliation run",
  robots: { index: false, follow: false },
};

export default function ReconciliationRunPage({ params }: { params: Promise<{ runId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <ReconciliationRunContent params={params} />
    </Suspense>
  );
}

async function ReconciliationRunContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!uuidSchema.safeParse(runId).success) notFound();
  await requireAdmin();

  const run = await getReconciliationRun(runId);
  if (!run) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <Link
        href="/admin/reconciliation"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Payment reconciliation
      </Link>

      <header>
        <h1 className="font-display text-3xl tracking-tight">{run.runNumber}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {run.checkedCount} records checked · {run.findingCount} finding(s) · {run.status}
        </p>
      </header>

      {run.findings.length === 0 ? (
        <p className="text-sm text-success">Everything reconciled in this run.</p>
      ) : (
        <ul className="space-y-2">
          {run.findings.map((finding) => (
            <li key={finding.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs">{finding.code}</span>
                <Badge tone={finding.severity === "ERROR" ? "neutral" : "neutral"}>
                  {finding.severity}
                </Badge>
              </div>
              <p className="mt-2 text-sm">{finding.message}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {finding.expected ? `expected ${finding.expected}` : ""}
                {finding.expected && finding.actual ? " · " : ""}
                {finding.actual ? `actual ${finding.actual}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
