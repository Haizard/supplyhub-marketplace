import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton, QuotationForm } from "@/components/b2b/forms";
import { SellerB2bNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { updateRfqStatusAction } from "@/features/b2b/actions";
import { getRfq } from "@/features/b2b/queries";
import { RFQ_TRANSITIONS } from "@/features/b2b/status";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

interface Props {
  params: Promise<{ rfqId: string }>;
}

export const metadata: Metadata = {
  title: "RFQ detail",
  robots: { index: false, follow: false },
};

export default function VendorRfqDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <VendorRfqDetailContent params={params} />
    </Suspense>
  );
}

async function VendorRfqDetailContent({ params }: Props) {
  const { rfqId } = await params;
  const access = await requireStudioAccess("wholesale.manage", `/vendor/rfq/${rfqId}`);
  const { t } = await getServerI18n();
  const rfq = await getRfq(rfqId, { supplierVendorId: access.vendorId });
  if (!rfq) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{rfq.rfqNumber}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{t("b2b.rfqs")}</h1>
        </div>
        <B2bStatusBadge status={rfq.status} />
      </header>
      <SellerB2bNav />

      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {rfq.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{item.productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</p>
            </div>
            <p className="text-sm">
              {item.quantity} · {item.unit}
            </p>
          </li>
        ))}
      </ul>

      {rfq.note ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          {rfq.note}
        </p>
      ) : null}

      {RFQ_TRANSITIONS[rfq.status].includes("REJECTED") ? (
        <ActionButton
          action={updateRfqStatusAction}
          hidden={{ rfqId: rfq.id, toStatus: "REJECTED" }}
          label={t("b2b.decline")}
          variant="secondary"
        />
      ) : null}

      {rfq.status === "SUBMITTED" || rfq.status === "QUOTED" ? (
        <QuotationForm rfqId={rfq.id} currency={rfq.currency} items={rfq.items} />
      ) : null}
    </PageShell>
  );
}
