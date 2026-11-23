import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { listBusinessPurchaseOrders } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Purchase orders",
  robots: { index: false, follow: false },
};

export default function BuyerPurchaseOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <BuyerPurchaseOrdersContent />
    </Suspense>
  );
}

async function BuyerPurchaseOrdersContent() {
  const context = await requireBuyerContext("/b2b/purchase-orders");
  const { t, formatDate } = await getServerI18n();
  const orders = await listBusinessPurchaseOrders(context.businessId);

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("b2b.purchaseOrders")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
        </div>
        <Link
          href="/b2b/purchase-orders/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          {t("b2b.newPo")}
        </Link>
      </header>
      <BuyerNav />
      {orders.length === 0 ? (
        <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/b2b/purchase-orders/${order.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {order.poNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {order.supplierName} · {order.total} {order.currency} ·{" "}
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <B2bStatusBadge status={order.status} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
