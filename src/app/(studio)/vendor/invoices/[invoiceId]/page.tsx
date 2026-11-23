import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SellerB2bNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getInvoice } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

interface Props {
  params: Promise<{ invoiceId: string }>;
}

export const metadata: Metadata = {
  title: "Wholesale invoice",
  robots: { index: false, follow: false },
};

export default function VendorInvoiceDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <VendorInvoiceDetailContent params={params} />
    </Suspense>
  );
}

async function VendorInvoiceDetailContent({ params }: Props) {
  const { invoiceId } = await params;
  const access = await requireStudioAccess("wholesale.manage", `/vendor/invoices/${invoiceId}`);
  const { t, formatDate } = await getServerI18n();
  const invoice = await getInvoice(invoiceId, { supplierVendorId: access.vendorId });
  if (!invoice) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{t("b2b.invoices")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("b2b.number")} {invoice.poNumber} · {formatDate(invoice.createdAt)}
          </p>
        </div>
        <B2bStatusBadge status={invoice.status} />
      </header>
      <SellerB2bNav />

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

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between py-0.5">
          <span className="text-muted-foreground">{t("b2b.subtotal")}</span>
          <span>
            {invoice.subtotal} {invoice.currency}
          </span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted-foreground">{t("b2b.tax")}</span>
          <span>
            {invoice.taxTotal} {invoice.currency}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
          <span>{t("b2b.amountPaid")}</span>
          <span>
            {invoice.amountPaid} / {invoice.total} {invoice.currency}
          </span>
        </div>
      </div>
    </PageShell>
  );
}
