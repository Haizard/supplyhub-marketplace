import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/b2b/forms";
import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { updateRfqStatusAction } from "@/features/b2b/actions";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { getRfq } from "@/features/b2b/queries";
import { RFQ_TRANSITIONS } from "@/features/b2b/status";
import { getServerI18n } from "@/i18n/server";

interface Props {
  params: Promise<{ rfqId: string }>;
}

export const metadata: Metadata = {
  title: "Request for quote",
  robots: { index: false, follow: false },
};

export default function RfqDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <RfqDetailContent params={params} />
    </Suspense>
  );
}

async function RfqDetailContent({ params }: Props) {
  const { rfqId } = await params;
  const context = await requireBuyerContext(`/b2b/rfq/${rfqId}`);
  const { t, formatDate } = await getServerI18n();
  const rfq = await getRfq(rfqId, { buyerBusinessId: context.businessId });
  if (!rfq) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{rfq.rfqNumber}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{t("b2b.rfqs")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rfq.supplierName} · {formatDate(rfq.createdAt)}
          </p>
        </div>
        <B2bStatusBadge status={rfq.status} />
      </header>
      <BuyerNav />

      {rfq.note ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          {rfq.note}
        </p>
      ) : null}

      <section aria-labelledby="rfq-items" className="space-y-3">
        <h2 id="rfq-items" className="text-lg font-medium">
          {t("b2b.items")}
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rfq.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</p>
              </div>
              <div className="text-right text-sm">
                <p>
                  {item.quantity} · {item.unit}
                </p>
                {item.targetPrice ? (
                  <p className="text-xs text-muted-foreground">
                    {t("b2b.targetPrice")}: {item.targetPrice} {rfq.currency}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rfq-quotes" className="space-y-3">
        <h2 id="rfq-quotes" className="text-lg font-medium">
          {t("b2b.quotations")}
        </h2>
        {rfq.quotations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("b2b.empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {rfq.quotations.map((quote) => (
              <li key={quote.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link
                    href={`/b2b/quotations/${quote.id}`}
                    className="font-mono text-sm font-medium hover:underline"
                  >
                    {quote.quotationNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {quote.itemCount} {t("b2b.items")} · {formatDate(quote.sentAt ?? rfq.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    {quote.subtotal} {quote.currency}
                  </span>
                  <B2bStatusBadge status={quote.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {RFQ_TRANSITIONS[rfq.status].includes("CANCELLED") ? (
        <ActionButton
          action={updateRfqStatusAction}
          hidden={{ rfqId: rfq.id, toStatus: "CANCELLED" }}
          label={t("b2b.cancel")}
          variant="secondary"
          withNote
        />
      ) : null}
    </PageShell>
  );
}
