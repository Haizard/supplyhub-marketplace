import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PaymentForm } from "@/components/b2b/forms";
import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { getInvoice } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";

interface Props {
  params: Promise<{ invoiceId: string }>;
}

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export default function InvoiceDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <InvoiceDetailContent params={params} />
    </Suspense>
  );
}

async function InvoiceDetailContent({ params }: Props) {
  const { invoiceId } = await params;
  const context = await requireBuyerContext(`/b2b/invoices/${invoiceId}`, "b2b.invoice.read");
  const { t, formatDate } = await getServerI18n();
  const invoice = await getInvoice(invoiceId, { businessId: context.businessId });
  if (!invoice) notFound();

  const balance = (Number(invoice.total) - Number(invoice.amountPaid)).toFixed(2);
  const canPay = ["ISSUED", "OVERDUE"].includes(invoice.status) && Number(balance) > 0;

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{t("b2b.invoices")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoice.supplierName} · {t("b2b.number")} {invoice.poNumber}
          </p>
        </div>
        <B2bStatusBadge status={invoice.status} />
      </header>
      <BuyerNav />

      <section aria-labelledby="invoice-items" className="space-y-3">
        <h2 id="invoice-items" className="text-lg font-medium">
          {t("b2b.items")}
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {invoice.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm font-medium">{item.description}</p>
              <p className="text-sm">
                {item.quantity} × {item.unitPrice} {invoice.currency}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <Line label={t("b2b.subtotal")} value={`${invoice.subtotal} ${invoice.currency}`} />
        <Line label={t("b2b.tax")} value={`${invoice.taxTotal} ${invoice.currency}`} />
        <Line label={t("b2b.amountPaid")} value={`${invoice.amountPaid} ${invoice.currency}`} />
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
          <span>{t("b2b.balance")}</span>
          <span>
            {balance} {invoice.currency}
          </span>
        </div>
        {invoice.dueAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("b2b.dueAt")}: {formatDate(invoice.dueAt)}
          </p>
        ) : null}
      </div>

      {canPay ? (
        <PaymentForm businessId={context.businessId} invoiceId={invoice.id} balance={balance} />
      ) : null}
    </PageShell>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
