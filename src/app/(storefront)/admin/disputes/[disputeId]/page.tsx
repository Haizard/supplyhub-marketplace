import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { DisputeStatusForm } from "@/components/admin/dispute-status-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDispute, listDisputeMessages } from "@/features/disputes/queries";
import { DISPUTE_STATUS_LABELS, isDisputeClosed } from "@/features/disputes/status";
import { requireAdmin } from "@/server/auth/guards";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Review dispute",
  robots: { index: false, follow: false },
};

export default function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <AdminDisputeDetailContent params={params} />
    </Suspense>
  );
}

async function AdminDisputeDetailContent({ params }: { params: Promise<{ disputeId: string }> }) {
  const { disputeId } = await params;
  if (!uuidSchema.safeParse(disputeId).success) notFound();
  await requireAdmin();

  const dispute = await getDispute(disputeId);
  if (!dispute) notFound();
  const messages = await listDisputeMessages(disputeId);

  return (
    <PageShell className="space-y-6 py-8">
      <Link href="/admin/disputes" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dispute centre
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{dispute.disputeNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dispute.reason} · {dispute.buyerName} · {dispute.vendorName}
          </p>
        </div>
        <Badge tone={dispute.status === "RESOLVED" ? "success" : "neutral"}>
          {DISPUTE_STATUS_LABELS[dispute.status]}
        </Badge>
      </header>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Report</h2>
        <p className="mt-2 text-sm leading-6 whitespace-pre-line text-muted-foreground">
          {dispute.description}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Conversation</h2>
        <ul className="space-y-2">
          {messages.map((message) => (
            <li key={message.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">
                {message.senderName} · {new Date(message.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 text-sm whitespace-pre-line">{message.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {!isDisputeClosed(dispute.status) ? (
        <section className="max-w-xl rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Decision</h2>
          <div className="mt-4">
            <DisputeStatusForm disputeId={dispute.id} status={dispute.status} />
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Closed as {DISPUTE_STATUS_LABELS[dispute.status].toLowerCase()}.
          {dispute.resolutionNote ? ` ${dispute.resolutionNote}` : ""}
        </p>
      )}
    </PageShell>
  );
}
