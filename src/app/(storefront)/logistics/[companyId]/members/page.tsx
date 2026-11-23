import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AssignRoleForm } from "@/components/logistics/assign-role-form";
import { CompanyNav } from "@/components/logistics/company-nav";
import { MemberInviteForm } from "@/components/logistics/member-invite-form";
import { MemberStatusForm } from "@/components/logistics/member-status-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLogisticsCompany,
  listCompanyMembers,
  listCompanyRoles,
} from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company members",
  robots: { index: false, follow: false },
};

export default function CompanyMembersPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyMembersContent params={params} />
    </Suspense>
  );
}

async function CompanyMembersContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.company.read",
    companyId,
    `/logistics/${companyId}/members`,
  );
  const [company, members, roles] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyMembers(companyId),
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
        <h1 className="font-display text-3xl tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company membership is separate from marketplace roles.
        </p>
      </header>

      <CompanyNav companyId={companyId} active="members" />

      <ul className="space-y-3">
        {members.map((member) => (
          <li key={member.id} className="space-y-3 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {member.roles.map((role) => role.name).join(", ") || "No roles"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={member.status === "ACTIVE" ? "success" : "neutral"}>
                  {member.status}
                </Badge>
                {canManage ? (
                  <MemberStatusForm
                    companyId={companyId}
                    memberId={member.id}
                    status={member.status}
                  />
                ) : null}
              </div>
            </div>
            {canManage ? (
              <AssignRoleForm companyId={companyId} memberId={member.id} roles={roles} />
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <section className="max-w-xl rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Invite a member</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The user must already have a SupplyHub account.
          </p>
          <div className="mt-4">
            <MemberInviteForm companyId={companyId} roles={roles} />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
