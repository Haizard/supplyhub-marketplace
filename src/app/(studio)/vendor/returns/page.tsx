import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReturnDecisionForm } from "@/components/vendor/return-decision-form";
import { StudioPageHead } from "@/components/vendor/studio-page-head";
import { listVendorReturns } from "@/features/returns/queries";
import {
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TONES,
} from "@/features/returns/status";
import { formatDate } from "@/lib/utils/format-date";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Studio returns",
  robots: { index: false, follow: false },
};

export default function VendorReturnsPage() {
  return (
    <Suspense fallback={<ReturnsSkeleton />}>
      <VendorReturnsContent />
    </Suspense>
  );
}

async function VendorReturnsContent() {
  const { vendorId } = await requireStudioAccess("orders.read", "/vendor/returns");
  const returns = await listVendorReturns(vendorId);

  return (
    <>
      <StudioPageHead
        title="Returns"
        description="Buyers can ask to send objects back once an order is paid. Approve, decline, or mark a return received. Refunds are handled outside this flow."
      />

      {returns.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="size-5" aria-hidden="true" />}
          title="No return requests."
          description="Requests for your studio's objects will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {returns.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-mono text-sm font-medium">{entry.returnNumber}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.orderNumber} · {entry.customerName} · {formatDate(entry.requestedAt)}
                  </p>
                </div>
                <Badge tone={RETURN_STATUS_TONES[entry.status]}>
                  {RETURN_STATUS_LABELS[entry.status]}
                </Badge>
              </div>

              <ul className="mt-4 space-y-1 text-sm">
                {entry.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="text-muted-foreground">
                      {RETURN_REASON_LABELS[item.reason]}
                    </span>
                  </li>
                ))}
              </ul>

              {entry.note ? (
                <p className="mt-3 rounded-md bg-surface-muted/60 p-3 text-sm text-muted-foreground">
                  “{entry.note}”
                </p>
              ) : null}

              {entry.vendorNote ? (
                <p className="mt-2 text-xs text-muted-foreground">Your note: {entry.vendorNote}</p>
              ) : null}

              <ReturnDecisionForm returnId={entry.id} status={entry.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ReturnsSkeleton() {
  return (
    <div role="status" aria-label="Loading returns" className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
