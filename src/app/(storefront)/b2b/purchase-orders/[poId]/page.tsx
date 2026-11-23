import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/b2b/forms";
import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { updatePurchaseOrderStatusAction } from "@/features/b2b/actions";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { getPurchaseOrder, listBusinessInvoices } from "@/features/b2b/queries";
import { PURCHASE_ORDER_TRANSITIONS } from "@/features/b2b/status";
import { getServerI18n } from "@/i18n/server";

interface Props {
  params: Promise<{ poId: string }>;
}

export const metadata: Metadata = {
  title: "Purchase order",
  robots: { index: false, follow: false },
};

export default function PurchaseOrderDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <PurchaseOrderDetailContent params={params} />
    </Suspense>
  );
}

async function PurchaseOrderDetailContent({ params }: Props) {
  const { poId } = await params;
  const context = await requireBuyerContext(`/b2b/purchase-orders/${poId}`);
  const { t } = await getServerI18n();
  const [order, invoices] = await Promise.all([
    getPurchaseOrder(poId, { businessId: context.businessId }),
    listBusinessInvoices(context.businessId),
  ]);
  if (!order) notFound();

  const invoice = invoices.find((entry) => entry.purchaseOrderId === order.id);
  const transitions = PURCHASE_ORDER_TRANSITIONS[order.status];

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{order.poNumber}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{t("b2b.purchaseOrders")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{order.supplierName}</p>
        </div>
        <B2bStatusBadge status={order.status} />
      </header>
      <BuyerNav />

      <section aria-labelledby="po-items" className="space-y-3">
        <h2 id="po-items" className="text-lg font-medium">
          {t("b2b.items")}
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</p>
              </div>
              <div className="text-right text-sm">
                <p>
                  {item.quantity} × {item.unitPrice} {order.currency}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("b2b.receive")}: {item.receivedQuantity} · {t("b2b.lineTotal")}:{" "}
                  {item.lineTotal}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <Line label={t("b2b.subtotal")} value={`${order.subtotal} ${order.currency}`} />
        <Line label={t("b2b.tax")} value={`${order.taxTotal} ${order.currency}`} />
        <Line label={t("b2b.shipping")} value={`${order.shippingTotal} ${order.currency}`} />
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
          <span>{t("b2b.total")}</span>
          <span>
            {order.total} {order.currency}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {transitions.includes("RECEIVED") ? (
          <ActionButton
            action={updatePurchaseOrderStatusAction}
            hidden={{ poId: order.id, toStatus: "RECEIVED" }}
            label={t("b2b.receive")}
          />
        ) : null}
        {transitions.includes("CANCELLED") ? (
          <ActionButton
            action={updatePurchaseOrderStatusAction}
            hidden={{ poId: order.id, toStatus: "CANCELLED" }}
            label={t("b2b.cancel")}
            variant="secondary"
            withNote
          />
        ) : null}
        {invoice ? (
          <Link
            href={`/b2b/invoices/${invoice.id}`}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-muted"
          >
            {invoice.invoiceNumber}
          </Link>
        ) : null}
      </div>
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
