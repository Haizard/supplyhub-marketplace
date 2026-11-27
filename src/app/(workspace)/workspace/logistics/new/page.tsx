import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CompanyForm } from "@/components/logistics/company-form";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listActorCompanies } from "@/features/logistics-companies/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Register a logistics company",
  description: "Create the company you will manage from your workspace.",
  robots: { index: false, follow: false },
};

export default function NewLogisticsCompanyPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <NewLogisticsCompanyContent />
    </Suspense>
  );
}

async function NewLogisticsCompanyContent() {
  const actor = await requireActor("/workspace/logistics/new");
  const [{ t }, companies, enabled] = await Promise.all([
    getServerI18n(),
    listActorCompanies(actor.id),
    isFeatureEnabled("phase9.logisticsNetwork"),
  ]);

  // One operator, one company: a member continues in the console they already have.
  const existing = companies[0];
  if (existing) redirect(`/logistics/${existing.id}`);

  return (
    <PageShell className="max-w-2xl space-y-6 py-8">
      <Link
        href="/logistics"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t("logistics.registerPage.back")}
      </Link>

      <header>
        <p className="eyebrow text-muted-foreground">{t("logistics.registerPage.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight">
          {t("logistics.registerPage.title")}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {t("logistics.registerPage.body")}
        </p>
      </header>

      {enabled ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <CompanyForm />
        </section>
      ) : (
        <EmptyState title="Coming soon" description="The logistics network is not enabled yet." />
      )}
    </PageShell>
  );
}
