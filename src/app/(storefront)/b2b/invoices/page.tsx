import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { listBusinessInvoices } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};

export default function BuyerInvoicesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <BuyerInvoicesContent />
    </Suspense>
  );
}

async function BuyerInvoicesContent() {
  const context = await requireBuyerContext("/b2b/invoices", "b2b.invoice.read");
  const { t, formatDate } = await getServerI18n();
  const invoices = await listBusinessInvoices(context.businessId);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("b2b.invoices")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
      </header>
      <BuyerNav />
      {invoices.length === 0 ? (
        <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/b2b/invoices/${invoice.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {invoice.invoiceNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {invoice.supplierName} · {invoice.total} {invoice.currency} ·{" "}
                  {formatDate(invoice.createdAt)}
                </p>
              </div>
              <B2bStatusBadge status={invoice.status} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
