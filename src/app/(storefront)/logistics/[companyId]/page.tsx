import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import { SubmitCompanyForm } from "@/components/logistics/submit-company-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { COMPANY_STATUS_LABELS } from "@/features/logistics-companies/status";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Logistics company",
  robots: { index: false, follow: false },
};

export default function LogisticsCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <LogisticsCompanyContent params={params} />
    </Suspense>
  );
}

async function LogisticsCompanyContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.company.read",
    companyId,
    `/logistics/${companyId}`,
  );
  const company = await getLogisticsCompany(companyId);
  if (!company) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <Link href="/logistics" className="text-sm text-muted-foreground hover:text-foreground">
        ← Logistics network
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{company.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.companyCode} · {company.city ?? "—"} · plan: {company.plan}
          </p>
        </div>
        <Badge tone={company.status === "APPROVED" ? "success" : "neutral"}>
          {COMPANY_STATUS_LABELS[company.status]}
        </Badge>
      </header>

      <CompanyNav companyId={companyId} active="overview" />

      {company.description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{company.description}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/logistics/${company.id}/members`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Members</p>
          <p className="mt-1 text-xs text-muted-foreground">{company.memberCount} member(s)</p>
        </Link>
        <Link
          href={`/logistics/${company.id}/fleet`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Fleet</p>
          <p className="mt-1 text-xs text-muted-foreground">Vehicles and documents</p>
        </Link>
        <Link
          href={`/logistics/${company.id}/drivers`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Drivers</p>
          <p className="mt-1 text-xs text-muted-foreground">Profiles and memberships</p>
        </Link>
        <Link
          href={`/logistics/${company.id}/clients`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Clients</p>
          <p className="mt-1 text-xs text-muted-foreground">Merchant relationships</p>
        </Link>
        <Link
          href={`/logistics/${company.id}/contracts`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Contracts</p>
          <p className="mt-1 text-xs text-muted-foreground">Pricing and SLAs</p>
        </Link>
        <Link
          href={`/logistics/${company.id}/dispatch`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Dispatch</p>
          <p className="mt-1 text-xs text-muted-foreground">Requests and assignments</p>
        </Link>
        <Link
          href={`/logistics/${company.id}/finance`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Finance</p>
          <p className="mt-1 text-xs text-muted-foreground">Earnings, expenses and settlements</p>
        </Link>
        <Link
          href={`/logistics/${company.id}/roles`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Roles</p>
          <p className="mt-1 text-xs text-muted-foreground">{company.roleCount} role(s)</p>
        </Link>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-display text-lg font-medium">Verification</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {COMPANY_STATUS_LABELS[company.status]}
          </p>
        </div>
      </section>

      {company.status === "PENDING" ? (
        <section className="max-w-xl rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Verification</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit your profile for administrator review before taking live deliveries.
          </p>
          <div className="mt-4">
            <SubmitCompanyForm companyId={company.id} />
          </div>
        </section>
      ) : null}

      {access.isOwner ? (
        <p className="text-xs text-muted-foreground">
          You are the owner of this company. Fleet, drivers and contracts arrive in later slices.
        </p>
      ) : null}
    </PageShell>
  );
}
