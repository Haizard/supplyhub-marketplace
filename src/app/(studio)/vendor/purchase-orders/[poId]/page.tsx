import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/b2b/forms";
import { SellerB2bNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { PurchaseOrderStatus } from "@/generated/prisma/enums";
import { issueInvoiceAction, updatePurchaseOrderStatusAction } from "@/features/b2b/actions";
import { getPurchaseOrder, listSupplierInvoices } from "@/features/b2b/queries";
import { PURCHASE_ORDER_TRANSITIONS } from "@/features/b2b/status";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

interface Props {
  params: Promise<{ poId: string }>;
}

export const metadata: Metadata = {
  title: "Wholesale purchase order",
  robots: { index: false, follow: false },
};

export default function VendorPurchaseOrderDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <VendorPurchaseOrderDetailContent params={params} />
    </Suspense>
  );
}

async function VendorPurchaseOrderDetailContent({ params }: Props) {
  const { poId } = await params;
  const access = await requireStudioAccess("wholesale.manage", `/vendor/purchase-orders/${poId}`);
  const { t } = await getServerI18n();
  const [order, invoices] = await Promise.all([
    getPurchaseOrder(poId, { supplierVendorId: access.vendorId }),
    listSupplierInvoices(access.vendorId),
  ]);
  if (!order) notFound();

  const invoice = invoices.find((entry) => entry.purchaseOrderId === order.id);
  const transitions = PURCHASE_ORDER_TRANSITIONS[order.status];
  const supplierActions: { to: PurchaseOrderStatus; label: string }[] = [
    { to: "CONFIRMED" as PurchaseOrderStatus, label: t("b2b.confirm") },
    { to: "PROCESSING" as PurchaseOrderStatus, label: t("b2b.status.PROCESSING") },
    { to: "SHIPPED" as PurchaseOrderStatus, label: t("b2b.ship") },
  ].filter((action) => transitions.includes(action.to));

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{order.poNumber}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{t("b2b.purchaseOrders")}</h1>
          {order.quotationNumber ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("b2b.quotations")}: {order.quotationNumber}
            </p>
          ) : null}
        </div>
        <B2bStatusBadge status={order.status} />
      </header>
      <SellerB2bNav />

      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {order.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-medium">{item.productName}</p>
            <p className="text-sm">
              {item.quantity} × {item.unitPrice} {order.currency}
            </p>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between font-medium">
          <span>{t("b2b.total")}</span>
          <span>
            {order.total} {order.currency}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {supplierActions.map((action) => (
          <ActionButton
            key={action.to}
            action={updatePurchaseOrderStatusAction}
            hidden={{ poId: order.id, toStatus: action.to }}
            label={action.label}
            variant={action.to === "SHIPPED" ? "primary" : "secondary"}
          />
        ))}
        {!invoice && ["SHIPPED", "RECEIVED"].includes(order.status) ? (
          <ActionButton
            action={issueInvoiceAction}
            hidden={{ poId: order.id }}
            label={t("b2b.issueInvoice")}
          />
        ) : null}
        {invoice ? (
          <a
            href={`/vendor/invoices/${invoice.id}`}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-muted"
          >
            {invoice.invoiceNumber}
          </a>
        ) : null}
      </div>
    </PageShell>
  );
}
