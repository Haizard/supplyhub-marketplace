import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SellerB2bNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listSupplierPurchaseOrders } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Wholesale purchase orders",
  robots: { index: false, follow: false },
};

export default function VendorPurchaseOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <VendorPurchaseOrdersContent />
    </Suspense>
  );
}

async function VendorPurchaseOrdersContent() {
  const access = await requireStudioAccess("wholesale.manage", "/vendor/purchase-orders");
  const { t, formatDate } = await getServerI18n();
  const orders = await listSupplierPurchaseOrders(access.vendorId);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("b2b.purchaseOrders")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
      </header>
      <SellerB2bNav />
      {orders.length === 0 ? (
        <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/vendor/purchase-orders/${order.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {order.poNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {order.total} {order.currency} · {formatDate(order.createdAt)}
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
