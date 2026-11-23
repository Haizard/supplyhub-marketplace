import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import { SettingsForm } from "@/components/logistics/settings-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanySettings, getLogisticsCompany } from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company settings",
  robots: { index: false, follow: false },
};

export default function CompanySettingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <CompanySettingsContent params={params} />
    </Suspense>
  );
}

async function CompanySettingsContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.company.read",
    companyId,
    `/logistics/${companyId}/settings`,
  );
  const [company, settings] = await Promise.all([
    getLogisticsCompany(companyId),
    getCompanySettings(companyId),
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
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defaults are configurable values, not business policy.
        </p>
      </header>
      <CompanyNav companyId={companyId} active="settings" />

      {canManage ? (
        <div className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <SettingsForm companyId={companyId} settings={settings} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have permission to edit settings.
        </p>
      )}
    </PageShell>
  );
}
