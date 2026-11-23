import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SellerB2bNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listSupplierRfqs } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Incoming RFQs",
  robots: { index: false, follow: false },
};

export default function VendorRfqPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <VendorRfqContent />
    </Suspense>
  );
}

async function VendorRfqContent() {
  const access = await requireStudioAccess("wholesale.manage", "/vendor/rfq");
  const { t, formatDate } = await getServerI18n();
  const rfqs = await listSupplierRfqs(access.vendorId);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("b2b.rfqs")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
      </header>
      <SellerB2bNav />
      {rfqs.length === 0 ? (
        <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rfqs.map((rfq) => (
            <li key={rfq.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/vendor/rfq/${rfq.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {rfq.rfqNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {rfq.itemCount} {t("b2b.items")} · {rfq.quotationCount} {t("b2b.quotations")} ·{" "}
                  {formatDate(rfq.submittedAt ?? rfq.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <B2bStatusBadge status={rfq.status} />
                <Link
                  href={`/vendor/rfq/${rfq.id}`}
                  className="text-sm text-accent hover:underline"
                >
                  {t("b2b.view")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
