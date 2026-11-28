import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { BranchForm } from "@/components/logistics/branch-form";
import { BranchStatusForm } from "@/components/logistics/branch-status-form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/logistics/console-ui";
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
    <div className="space-y-6">
      <ConsolePageHeader
        title="Branches"
        description="Operating locations used for coverage and dispatch in later slices."
      />

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
    </div>
  );
}
