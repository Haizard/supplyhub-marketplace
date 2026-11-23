import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { OpenDisputeForm } from "@/components/disputes/open-dispute-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listBuyerDisputes, listDisputableOrders } from "@/features/disputes/queries";
import { DISPUTE_STATUS_LABELS } from "@/features/disputes/status";
import { requireCustomer } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "My disputes",
  robots: { index: false, follow: false },
};

export default function AccountDisputesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AccountDisputesContent />
    </Suspense>
  );
}

async function AccountDisputesContent() {
  const actor = await requireCustomer("/account/disputes");
  const [disputes, orders] = await Promise.all([
    listBuyerDisputes(actor.id),
    listDisputableOrders(actor.id),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">My disputes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raise a problem with an order and track the administrator&apos;s response.
        </p>
      </header>

      {disputes.length === 0 ? (
        <EmptyState
          title="No disputes"
          description="If something is wrong with an order, open a dispute below."
        />
      ) : (
        <ul className="space-y-3">
          {disputes.map((dispute) => (
            <li
              key={dispute.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <Link
                  href={`/account/disputes/${dispute.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {dispute.disputeNumber}
                </Link>
                <p className="mt-1 text-sm">
                  {dispute.reason} · {dispute.vendorName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Order {dispute.orderNumber} · {new Date(dispute.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge tone={dispute.status === "RESOLVED" ? "success" : "neutral"}>
                {DISPUTE_STATUS_LABELS[dispute.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Open a dispute</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an eligible order line and describe what went wrong.
        </p>
        <div className="mt-4 max-w-xl">
          <OpenDisputeForm orders={orders} />
        </div>
      </section>
    </PageShell>
  );
}
