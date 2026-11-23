import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listActiveWholesaleListings,
  listBuyerRfqs,
  listBusinessInvoices,
  listBusinessPurchaseOrders,
} from "@/features/b2b/queries";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "B2B workspace",
  robots: { index: false, follow: false },
};

export default function B2bPage() {
  return (
    <Suspense fallback={<B2bSkeleton />}>
      <B2bContent />
    </Suspense>
  );
}

async function B2bContent() {
  const context = await requireBuyerContext("/b2b");
  const { t, formatDate } = await getServerI18n();
  const [listings, rfqs, orders, invoices] = await Promise.all([
    listActiveWholesaleListings(),
    listBuyerRfqs(context.businessId),
    listBusinessPurchaseOrders(context.businessId),
    listBusinessInvoices(context.businessId),
  ]);

  const openOrders = orders.filter((order) => !["RECEIVED", "CANCELLED"].includes(order.status));
  const unpaidInvoices = invoices.filter(
    (invoice) => !["PAID", "CANCELLED"].includes(invoice.status),
  );

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("b2b.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{context.businessName}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
        </div>
        <Link
          href="/b2b/rfq/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          {t("b2b.newRfq")}
        </Link>
      </header>

      <BuyerNav />

      <section className="grid gap-3 sm:grid-cols-4">
        <Summary label={t("b2b.catalog")} value={String(listings.length)} />
        <Summary label={t("b2b.rfqs")} value={String(rfqs.length)} />
        <Summary label={t("b2b.purchaseOrders")} value={String(openOrders.length)} />
        <Summary label={t("b2b.balance")} value={String(unpaidInvoices.length)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="b2b-recent-rfq" className="space-y-3">
          <h2 id="b2b-recent-rfq" className="text-lg font-medium">
            {t("b2b.rfqs")}
          </h2>
          {rfqs.length === 0 ? (
            <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {rfqs.slice(0, 5).map((rfq) => (
                <li key={rfq.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <Link
                      href={`/b2b/rfq/${rfq.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {rfq.rfqNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {rfq.supplierName} · {formatDate(rfq.createdAt)}
                    </p>
                  </div>
                  <B2bStatusBadge status={rfq.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="b2b-recent-po" className="space-y-3">
          <h2 id="b2b-recent-po" className="text-lg font-medium">
            {t("b2b.purchaseOrders")}
          </h2>
          {orders.length === 0 ? (
            <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {orders.slice(0, 5).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <Link
                      href={`/b2b/purchase-orders/${order.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {order.poNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {order.supplierName} · {order.total} {order.currency}
                    </p>
                  </div>
                  <B2bStatusBadge status={order.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function B2bSkeleton() {
  return (
    <PageShell className="space-y-6 py-8" role="status" aria-label="Loading B2B workspace">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
    </PageShell>
  );
}
