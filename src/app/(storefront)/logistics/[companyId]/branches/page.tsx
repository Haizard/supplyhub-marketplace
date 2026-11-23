import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { BranchForm } from "@/components/logistics/branch-form";
import { BranchStatusForm } from "@/components/logistics/branch-status-form";
import { CompanyNav } from "@/components/logistics/company-nav";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany, listCompanyBranches } from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company branches",
  robots: { index: false, follow: false },
};

export default function CompanyBranchesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyBranchesContent params={params} />
    </Suspense>
  );
}

async function CompanyBranchesContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.company.read",
    companyId,
    `/logistics/${companyId}/branches`,
  );
  const [company, branches] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyBranches(companyId),
  ]);
  if (!company) notFound();

  const canManage =
    access.permissions.has("*") || access.permissions.has("logistics.company.update");

  return (
    <PageShell className="space-y-6 py-8">
      <Link
        href={`/logistics/${companyId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {company.name}
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight">Branches</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operating locations used for coverage and dispatch in later slices.
        </p>
      </header>
      <CompanyNav companyId={companyId} active="branches" />

      {branches.length > 0 ? (
        <ul className="space-y-3">
          {branches.map((branch) => (
            <li
              key={branch.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{branch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {branch.branchCode} · {branch.city || "—"} · {branch.address || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {branch.isPrimary ? <Badge tone="success">Primary</Badge> : null}
                  <Badge tone={branch.isActive ? "success" : "neutral"}>
                    {branch.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {canManage ? (
                    <BranchStatusForm
                      companyId={companyId}
                      branchId={branch.id}
                      isActive={branch.isActive}
                    />
                  ) : null}
                </div>
              </div>
              {canManage ? <BranchForm companyId={companyId} branch={branch} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No branches yet.</p>
      )}

      {canManage ? (
        <section className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Add a branch</h2>
          <div className="mt-4">
            <BranchForm companyId={companyId} />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
