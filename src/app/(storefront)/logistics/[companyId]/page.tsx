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
import { getServerI18n } from "@/i18n/server";
import { getSessionActor } from "@/server/auth/session";
import { tryLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Logistics company",
  robots: { index: false, follow: true },
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

  const company = await getLogisticsCompany(companyId);
  if (!company) notFound();

  // Members open the management console; everyone else gets the public profile.
  const access = await tryLogisticsAccess(companyId);
  if (!access) {
    if (company.status !== "APPROVED") notFound();
    return <PublicCompanyProfile company={company} />;
  }

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
          href={`/logistics/${company.id}/referrals`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
        >
          <p className="font-display text-lg font-medium">Partner growth</p>
          <p className="mt-1 text-xs text-muted-foreground">Referrals and eligible rewards</p>
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

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** What a buyer sees: the company as a public listing, with no management tools. */
async function PublicCompanyProfile({
  company,
}: {
  company: NonNullable<Awaited<ReturnType<typeof getLogisticsCompany>>>;
}) {
  const [{ t, formatDate }, actor] = await Promise.all([getServerI18n(), getSessionActor()]);
  const signInHref = `/sign-in?next=${encodeURIComponent(`/logistics/${company.id}`)}`;

  return (
    <PageShell className="space-y-8 py-8">
      <Link href="/logistics" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("logistics.public.back")}
      </Link>

      <header className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground">{t("marketplaces.logistics")}</p>
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-balance">
              {company.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {company.companyCode} · {company.city ?? "—"} · {sentenceCase(company.plan)}{" "}
              {t("logistics.public.plan").toLowerCase()}
            </p>
          </div>
          <Badge tone="success">{COMPANY_STATUS_LABELS[company.status]}</Badge>
        </div>
        {company.description ? (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            {company.description}
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">{t("logistics.public.facts")}</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">{t("logistics.public.members")}</dt>
              <dd className="font-medium tabular-nums">{company.memberCount}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">{t("logistics.public.roles")}</dt>
              <dd className="font-medium tabular-nums">{company.roleCount}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">{t("logistics.public.plan")}</dt>
              <dd className="font-medium">{sentenceCase(company.plan)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">{t("logistics.public.city")}</dt>
              <dd className="font-medium">{company.city ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">{t("logistics.public.joined")}</dt>
              <dd className="font-medium">{formatDate(company.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <aside className="space-y-4 self-start">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">{t("logistics.public.delivery")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("logistics.public.deliveryBody")}
            </p>
            <Link
              href="/delivery/request"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent/90"
            >
              {t("logistics.public.delivery")}
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/60 p-6">
            <h2 className="font-display text-lg font-medium">{t("logistics.public.operator")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("logistics.public.operatorBody")}
            </p>
            <Link
              href={actor ? "/workspace" : signInHref}
              className="mt-3 inline-flex text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              {actor ? t("logistics.public.workspace") : t("logistics.public.signIn")}
            </Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
