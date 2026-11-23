import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import { RoleForm } from "@/components/logistics/role-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany, listCompanyRoles } from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company roles",
  robots: { index: false, follow: false },
};

export default function CompanyRolesPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <CompanyRolesContent params={params} />
    </Suspense>
  );
}

async function CompanyRolesContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.company.read",
    companyId,
    `/logistics/${companyId}/roles`,
  );
  const [company, roles] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyRoles(companyId),
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
        <h1 className="font-display text-3xl tracking-tight">Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles use the platform permission keys, scoped to this company.
        </p>
      </header>

      <CompanyNav companyId={companyId} active="roles" />

      <ul className="space-y-3">
        {roles.map((role) => (
          <li key={role.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{role.name}</p>
              <div className="flex items-center gap-2">
                {role.isSystem ? <Badge tone="neutral">System</Badge> : null}
                <span className="text-xs text-muted-foreground">{role.memberCount} member(s)</span>
              </div>
            </div>
            <p className="mt-2 flex flex-wrap gap-1">
              {role.permissions.map((permission) => (
                <Badge key={permission} tone="neutral">
                  {permission}
                </Badge>
              ))}
            </p>
          </li>
        ))}
      </ul>

      {canManage ? (
        <section className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Create a role</h2>
          <div className="mt-4">
            <RoleForm companyId={companyId} />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
