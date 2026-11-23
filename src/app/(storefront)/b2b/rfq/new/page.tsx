import type { Metadata } from "next";
import { Suspense } from "react";

import { RfqForm } from "@/components/b2b/forms";
import { BuyerNav } from "@/components/b2b/nav";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { listApprovedSuppliers } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "New request for quote",
  robots: { index: false, follow: false },
};

export default function NewRfqPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <NewRfqContent />
    </Suspense>
  );
}

async function NewRfqContent() {
  const context = await requireBuyerContext("/b2b/rfq/new", "b2b.rfq.create");
  const { t } = await getServerI18n();
  const suppliers = await listApprovedSuppliers();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("b2b.newRfq")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{context.businessName}</p>
      </header>
      <BuyerNav />
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("b2b.empty")}</p>
      ) : (
        <RfqForm businessId={context.businessId} suppliers={suppliers} />
      )}
    </PageShell>
  );
}
