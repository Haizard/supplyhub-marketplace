import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import { CompanyProfileForm } from "@/components/logistics/company-profile-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company profile",
  robots: { index: false, follow: false },
};

export default function EditCompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <EditCompanyContent params={params} />
    </Suspense>
  );
}

async function EditCompanyContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.company.read",
    companyId,
    `/logistics/${companyId}/edit`,
  );
  const company = await getLogisticsCompany(companyId);
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
        <h1 className="font-display text-3xl tracking-tight">Company profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Details shown to merchants and partners.
        </p>
      </header>
      <CompanyNav companyId={companyId} active="profile" />

      {canManage ? (
        <div className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <CompanyProfileForm
            company={{
              id: company.id,
              name: company.name,
              slug: company.slug,
              description: company.description,
              city: company.city,
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have permission to edit this profile.
        </p>
      )}
    </PageShell>
  );
}
