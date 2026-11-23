import type { Metadata } from "next";
import { Suspense } from "react";

import { PurchaseOrderForm } from "@/components/b2b/forms";
import { BuyerNav } from "@/components/b2b/nav";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { listAcceptedQuotations, listApprovedSuppliers } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "New purchase order",
  robots: { index: false, follow: false },
};

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <NewPurchaseOrderContent />
    </Suspense>
  );
}

async function NewPurchaseOrderContent() {
  const context = await requireBuyerContext(
    "/b2b/purchase-orders/new",
    "b2b.purchase_order.create",
  );
  const { t } = await getServerI18n();
  const [suppliers, quotations] = await Promise.all([
    listApprovedSuppliers(),
    listAcceptedQuotations(context.businessId),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("b2b.newPo")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{context.businessName}</p>
      </header>
      <BuyerNav />
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("b2b.empty")}</p>
      ) : (
        <PurchaseOrderForm
          businessId={context.businessId}
          suppliers={suppliers}
          quotations={quotations}
        />
      )}
    </PageShell>
  );
}
