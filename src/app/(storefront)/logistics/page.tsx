import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CompanyForm } from "@/components/logistics/company-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listActorCompanies } from "@/features/logistics-companies/queries";
import { COMPANY_STATUS_LABELS } from "@/features/logistics-companies/status";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Logistics network",
  robots: { index: false, follow: false },
};

export default function LogisticsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <LogisticsContent />
    </Suspense>
  );
}

async function LogisticsContent() {
  const enabled = await isFeatureEnabled("phase9.logisticsNetwork");
  const actor = await requireActor("/logistics");

  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight">Logistics network</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operate your own delivery business through the platform.
          </p>
        </header>
        <EmptyState
          title="Coming soon"
          description="The logistics network is not enabled yet. Check back after rollout."
        />
      </PageShell>
    );
  }

  const companies = await listActorCompanies(actor.id);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Logistics network</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a logistics company, build your team and manage your own delivery business.
        </p>
      </header>

      {companies.length > 0 ? (
        <ul className="space-y-3">
          {companies.map((company) => (
            <li
              key={company.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <Link href={`/logistics/${company.id}`} className="font-medium hover:underline">
                  {company.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {company.companyCode} · {company.city ?? "—"} · {company.memberCount} member(s)
                </p>
              </div>
              <Badge tone={company.status === "APPROVED" ? "success" : "neutral"}>
                {COMPANY_STATUS_LABELS[company.status]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Register a company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You become the owner. Submit the company for verification when your profile is ready.
        </p>
        <div className="mt-4">
          <CompanyForm />
        </div>
      </section>
    </PageShell>
  );
}
