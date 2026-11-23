import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BuyerNav } from "@/components/b2b/nav";
import { B2bStatusBadge } from "@/components/b2b/status-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBuyerContext } from "@/features/b2b/page-access";
import { listBuyerRfqs } from "@/features/b2b/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Requests for quote",
  robots: { index: false, follow: false },
};

export default function BuyerRfqPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <BuyerRfqContent />
    </Suspense>
  );
}

async function BuyerRfqContent() {
  const context = await requireBuyerContext("/b2b/rfq");
  const { t, formatDate } = await getServerI18n();
  const rfqs = await listBuyerRfqs(context.businessId);

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("b2b.rfqs")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("b2b.subtitle")}</p>
        </div>
        <Link
          href="/b2b/rfq/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          {t("b2b.newRfq")}
        </Link>
      </header>
      <BuyerNav />
      {rfqs.length === 0 ? (
        <EmptyState title={t("b2b.empty")} description={t("b2b.subtitle")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rfqs.map((rfq) => (
            <li key={rfq.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={`/b2b/rfq/${rfq.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {rfq.rfqNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {rfq.supplierName} · {rfq.itemCount} {t("b2b.items")} ·{" "}
                  {formatDate(rfq.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <B2bStatusBadge status={rfq.status} />
                <Link href={`/b2b/rfq/${rfq.id}`} className="text-sm text-accent hover:underline">
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
