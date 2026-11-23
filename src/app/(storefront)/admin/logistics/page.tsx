import type { Metadata } from "next";
import { Suspense } from "react";

import { CompanyReviewForm } from "@/components/admin/company-review-form";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listPendingLogisticsCompanies } from "@/features/logistics-companies/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Logistics companies",
  robots: { index: false, follow: false },
};

export default function AdminLogisticsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AdminLogisticsContent />
    </Suspense>
  );
}

async function AdminLogisticsContent() {
  await requireAdmin();
  const companies = await listPendingLogisticsCompanies();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Logistics companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review submitted companies before they can accept live deliveries.
        </p>
      </header>

      {companies.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Submitted logistics companies will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {companies.map((company) => (
            <li key={company.id} className="rounded-xl border border-border bg-surface p-5">
              <p className="font-medium">{company.name}</p>
              <p className="text-xs text-muted-foreground">
                {company.companyCode} · {company.city ?? "—"} · {company.memberCount} member(s)
              </p>
              {company.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{company.description}</p>
              ) : null}
              <div className="mt-4 max-w-lg">
                <CompanyReviewForm companyId={company.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
