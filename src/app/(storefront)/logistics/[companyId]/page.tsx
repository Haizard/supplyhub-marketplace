import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import { ConsolePageHeader, ConsoleSection, ConsoleStat } from "@/components/logistics/console-ui";
import { companySectionGroups } from "@/components/logistics/company-sections";
import { SubmitCompanyForm } from "@/components/logistics/submit-company-form";
import { ProviderVerifiedBadge } from "@/components/providers/verified-badge";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { COMPANY_STATUS_LABELS } from "@/features/logistics-companies/status";
import {
  listCompanyJobs,
  listCompanyRequests,
} from "@/features/logistics-company-dispatch/queries";
import { listVehicles } from "@/features/logistics-fleet/queries";
import { getServerI18n } from "@/i18n/server";
import { getSessionActor } from "@/server/auth/session";
import { tryLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

const CLOSED_REQUEST_STATUSES = ["COMPLETED", "CANCELLED", "FAILED", "EXPIRED"];
const CLOSED_JOB_STATUSES = ["DELIVERED", "COMPLETED", "CANCELLED", "FAILED"];

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

  return <CompanyOverview company={company} />;
}

/** The console landing page: where the company stands and what to do next. */
async function CompanyOverview({
  company,
}: {
  company: NonNullable<Awaited<ReturnType<typeof getLogisticsCompany>>>;
}) {
  const { t } = await getServerI18n();
  const base = `/logistics/${company.id}`;

  const [requests, jobs, vehicles] = await Promise.all([
    listCompanyRequests(company.id),
    listCompanyJobs(company.id),
    listVehicles(company.id),
  ]);

  const openRequests = requests.filter(
    (request) => !CLOSED_REQUEST_STATUSES.includes(request.status),
  ).length;
  const activeJobs = jobs.filter((job) => !CLOSED_JOB_STATUSES.includes(job.status)).length;
  const inService = vehicles.filter((vehicle) => vehicle.status === "ACTIVE").length;

  const pendingVerification = company.status === "PENDING";
  const needsFleet = vehicles.length === 0;
  const needsTeam = company.memberCount <= 1;

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t("logistics.overview.eyebrow")}
        title={t("logistics.overview.title")}
        description={t("logistics.overview.description", { company: company.name })}
        actions={
          <Button asChild size="sm">
            <Link href={`${base}/dispatch`}>
              {t("logistics.overview.newRequest")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ConsoleStat
          label={t("logistics.overview.stats.openRequests")}
          value={openRequests}
          hint={t("logistics.overview.stats.openRequestsHint")}
          href={`${base}/dispatch`}
          tone={openRequests > 0 ? "warning" : "neutral"}
        />
        <ConsoleStat
          label={t("logistics.overview.stats.activeJobs")}
          value={activeJobs}
          hint={t("logistics.overview.stats.activeJobsHint")}
          href={`${base}/jobs`}
        />
        <ConsoleStat
          label={t("logistics.overview.stats.vehicles")}
          value={`${inService}/${vehicles.length}`}
          hint={t("logistics.overview.stats.vehiclesHint")}
          href={`${base}/fleet`}
        />
        <ConsoleStat
          label={t("logistics.overview.stats.members")}
          value={company.memberCount}
          hint={t("logistics.overview.stats.membersHint", { roles: company.roleCount })}
          href={`${base}/members`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ConsoleSection
          title={t("logistics.overview.attention.title")}
          description={t("logistics.overview.attention.body")}
        >
          {pendingVerification || needsFleet || needsTeam ? (
            <ul className="divide-y divide-border">
              {pendingVerification ? (
                <AttentionRow
                  title={t("logistics.overview.attention.verifyTitle")}
                  body={t("logistics.overview.attention.verifyBody")}
                  href={`${base}#verification`}
                  action={t("logistics.overview.attention.verifyAction")}
                />
              ) : null}
              {needsFleet ? (
                <AttentionRow
                  title={t("logistics.overview.attention.fleetTitle")}
                  body={t("logistics.overview.attention.fleetBody")}
                  href={`${base}/fleet`}
                  action={t("logistics.overview.attention.fleetAction")}
                />
              ) : null}
              {needsTeam ? (
                <AttentionRow
                  title={t("logistics.overview.attention.membersTitle")}
                  body={t("logistics.overview.attention.membersBody")}
                  href={`${base}/members`}
                  action={t("logistics.overview.attention.membersAction")}
                />
              ) : null}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              {t("logistics.overview.attention.empty")}
            </p>
          )}
        </ConsoleSection>

        <ConsoleSection title={t("logistics.overview.quick.title")}>
          <div className="flex flex-col gap-2">
            <Button asChild variant="secondary" size="sm" className="justify-between">
              <Link href={`${base}/dispatch`}>
                {t("logistics.overview.quick.request")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="justify-between">
              <Link href={`${base}/fleet`}>
                {t("logistics.overview.quick.vehicle")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="justify-between">
              <Link href={`${base}/members`}>
                {t("logistics.overview.quick.invite")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="justify-between">
              <Link href={`${base}/edit`}>
                {t("logistics.overview.quick.profile")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </ConsoleSection>
      </div>

      {pendingVerification ? (
        <div id="verification" className="scroll-mt-32">
          <ConsoleSection
            title={t("logistics.overview.verify.title")}
            description={t("logistics.overview.verify.body")}
          >
            <SubmitCompanyForm companyId={company.id} />
          </ConsoleSection>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-medium">
              {t("logistics.overview.modules.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("logistics.overview.modules.body")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {companySectionGroups.map((group) => (
            <div key={group.key} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-mono text-[0.5625rem] tracking-[0.16em] text-muted-foreground uppercase">
                {t(`logistics.console.groups.${group.key}`)}
              </p>
              <ul className="mt-2.5 space-y-0.5">
                {group.items.map((section) => (
                  <li key={section.key}>
                    <Link
                      href={`${base}${section.suffix}`}
                      className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      <section.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{t(`logistics.console.nav.${section.key}`)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AttentionRow({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{body}</p>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link href={href}>
          {action}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
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
        {company.coverImageUrl ? (
          <div className="relative mb-6 aspect-[16/7] overflow-hidden rounded-xl bg-surface-muted">
            <Image
              src={company.coverImageUrl}
              alt={`${company.name} operations`}
              fill
              priority
              sizes="(min-width: 1024px) 60vw, 96vw"
              className="object-cover"
            />
          </div>
        ) : null}
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
          {company.providerVerified ? (
            <ProviderVerifiedBadge />
          ) : (
            <Badge tone="neutral">{COMPANY_STATUS_LABELS[company.status]}</Badge>
          )}
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
