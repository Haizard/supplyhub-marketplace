import type { Metadata } from "next";
import { MapPin, PackageCheck, Truck, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import {
  ListingBody,
  ListingCard,
  ListingFooter,
  ListingMedia,
  ListingSummary,
  ListingTitle,
  ProviderLabel,
} from "@/components/storefront/listing-card";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import {
  listActorCompanies,
  listPublicLogisticsCompanies,
} from "@/features/logistics-companies/queries";
import { COMPANY_STATUS_LABELS } from "@/features/logistics-companies/status";
import { getServerI18n } from "@/i18n/server";
import { getSessionActor } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Logistics network",
  description:
    "Delivery companies that operate on SupplyHub — book one for your orders, or register your own.",
};

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function LogisticsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <LogisticsContent />
    </Suspense>
  );
}

async function LogisticsContent() {
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase9.logisticsNetwork");

  if (!enabled) {
    return (
      <PageShell className="space-y-6 py-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight">Logistics network</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operate your own delivery business through the platform.
          </p>
        </header>
        <EmptyState
          title="Coming soon"
          description="The logistics network is not enabled yet. Check back after rollout."
        />
      </PageShell>
    );
  }

  const actor = await getSessionActor();
  const [publicCompanies, actorCompanies] = await Promise.all([
    listPublicLogisticsCompanies(),
    actor ? listActorCompanies(actor.id) : Promise.resolve([]),
  ]);
  const registerHref = actor
    ? "/workspace/logistics/new"
    : `/sign-in?next=${encodeURIComponent("/workspace/logistics/new")}`;

  return (
    <PageShell className="space-y-10 py-8">
      <header>
        <p className="eyebrow text-muted-foreground">Logistics</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Logistics network</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Delivery companies that operate on SupplyHub. Book one for your orders, or run your own
          company from your workspace.
        </p>
      </header>

      {actor && actorCompanies.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-medium">Your companies</h2>
            <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
              {actorCompanies.length} workspace{actorCompanies.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {actorCompanies.map((company) => (
              <li
                key={company.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5 transition-colors duration-300 hover:border-border-strong"
              >
                <div className="min-w-0">
                  <Link
                    href={`/logistics/${company.id}`}
                    className="font-display text-base font-medium underline-offset-4 hover:text-accent hover:underline"
                  >
                    {company.name}
                  </Link>
                  <p className="mt-1 font-mono text-[0.625rem] tracking-[0.13em] text-muted-foreground uppercase">
                    {company.companyCode} · {company.city ?? "—"} · {company.memberCount} member
                    {company.memberCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={company.status === "APPROVED" ? "success" : "neutral"}>
                    {COMPANY_STATUS_LABELS[company.status]}
                  </Badge>
                  <Link
                    href={`/workspace?as=logistics`}
                    className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {t("logistics.manage")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Delivery companies</h2>
          <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            {publicCompanies.length} approved
          </p>
        </div>
        {publicCompanies.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
            {publicCompanies.map((company) => (
              <ListingCard key={company.id}>
                <ListingMedia
                  href={`/logistics/${company.id}`}
                  tone="logistics"
                  icon={<Truck className="size-[46%]" strokeWidth={1.25} aria-hidden="true" />}
                  label={company.companyCode}
                  badge={<Badge tone="success">{COMPANY_STATUS_LABELS[company.status]}</Badge>}
                />
                <ListingBody>
                  <p className="flex flex-wrap items-baseline gap-x-1.5 font-semibold">
                    <span className="text-base">{sentenceCase(company.plan)} plan</span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {company.memberCount} {company.memberCount === 1 ? "member" : "members"}
                    </span>
                  </p>
                  <ListingTitle href={`/logistics/${company.id}`}>{company.name}</ListingTitle>
                  {company.description ? (
                    <ListingSummary>{company.description}</ListingSummary>
                  ) : null}
                  <ListingFooter>
                    <ProviderLabel
                      name={company.city ?? "—"}
                      meta={`${company.roleCount} ${company.roleCount === 1 ? "role" : "roles"}`}
                    />
                  </ListingFooter>
                </ListingBody>
              </ListingCard>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border-strong/60 bg-surface/60 px-4 py-6 text-sm text-muted-foreground">
            No approved companies yet.
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">{t("logistics.entry.title")}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("logistics.entry.body")}</p>
          <div className="mt-4">
            <Button asChild>
              <Link href={registerHref}>
                {actor ? t("logistics.entry.action") : t("logistics.entry.signIn")}
              </Link>
            </Button>
          </div>
        </div>
        <ul className="space-y-3 self-start rounded-xl border border-border bg-surface-muted/60 p-6 text-sm">
          <li className="flex items-center gap-2.5">
            <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
            Branch network and service radius
          </li>
          <li className="flex items-center gap-2.5">
            <PackageCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            Dispatch, jobs and contracts in one place
          </li>
          <li className="flex items-center gap-2.5">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            Roles for owners, dispatchers and drivers
          </li>
        </ul>
      </section>
    </PageShell>
  );
}
