import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/b2b/forms";
import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { updateQuotationStatusAction } from "@/features/b2b/actions";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { getQuotation } from "@/features/b2b/queries";
import { QUOTATION_TRANSITIONS } from "@/features/b2b/status";
import { getServerI18n } from "@/i18n/server";

interface Props {
  params: Promise<{ quotationId: string }>;
}

export const metadata: Metadata = {
  title: "Quotation",
  robots: { index: false, follow: false },
};

export default function QuotationDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <QuotationDetailContent params={params} />
    </Suspense>
  );
}

async function QuotationDetailContent({ params }: Props) {
  const { quotationId } = await params;
  const context = await requireBuyerContext(`/b2b/quotations/${quotationId}`);
  const { t } = await getServerI18n();
  const quotation = await getQuotation(quotationId, { buyerBusinessId: context.businessId });
  if (!quotation) notFound();

  const transitions = QUOTATION_TRANSITIONS[quotation.status];

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{quotation.quotationNumber}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{t("b2b.quotations")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quotation.supplierName} · {t("b2b.number")} {quotation.rfqNumber}
          </p>
        </div>
        <B2bStatusBadge status={quotation.status} />
      </header>
      <BuyerNav />

      <section aria-labelledby="quote-items" className="space-y-3">
        <h2 id="quote-items" className="text-lg font-medium">
          {t("b2b.items")}
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {quotation.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</p>
              </div>
              <div className="text-right text-sm">
                <p>
                  {item.quantity} × {item.unitPrice} {quotation.currency}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("b2b.lineTotal")}: {item.lineTotal} {quotation.currency}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("b2b.subtotal")}</span>
          <span className="font-medium">
            {quotation.subtotal} {quotation.currency}
          </span>
        </div>
        {quotation.note ? (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
            {quotation.note}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {transitions.includes("ACCEPTED") ? (
          <ActionButton
            action={updateQuotationStatusAction}
            hidden={{ quotationId: quotation.id, toStatus: "ACCEPTED" }}
            label={t("b2b.accept")}
          />
        ) : null}
        {transitions.includes("REJECTED") ? (
          <ActionButton
            action={updateQuotationStatusAction}
            hidden={{ quotationId: quotation.id, toStatus: "REJECTED" }}
            label={t("b2b.decline")}
            variant="secondary"
          />
        ) : null}
        {quotation.status === "ACCEPTED" ? (
          <Link
            href="/b2b/purchase-orders/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            {t("b2b.newPo")}
          </Link>
        ) : null}
      </div>
    </PageShell>
  );
}
