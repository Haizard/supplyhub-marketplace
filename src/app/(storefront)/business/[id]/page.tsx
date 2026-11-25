import type { Metadata } from "next";
import { Building2, CreditCard, GitBranch, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getBusinessById } from "@/features/business/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";
import { getSessionActor } from "@/server/auth/session";
import {
  BusinessAccessError,
  hasPermission,
  resolveBusinessContext,
} from "@/server/business/context";

interface Props {
  params: Promise<{ id: string }>;
}

const privateMetadata: Metadata = {
  title: "Business",
  robots: { index: false, follow: false },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const actor = await getSessionActor();
  if (!actor) return privateMetadata;

  const business = await getBusinessById(id);
  if (!business) return privateMetadata;

  // The name is only exposed to members (and admins) — metadata must not leak
  // the identity of a business the viewer cannot open.
  const allowed = await resolveBusinessContext(actor, id).then(
    () => true,
    () => false,
  );

  return allowed ? { title: `${business.name} — Business`, ...privateMetadata } : privateMetadata;
}

export default function BusinessPage({ params }: Props) {
  return (
    <Suspense fallback={<BusinessSkeleton />}>
      <BusinessContent params={params} />
    </Suspense>
  );
}

async function BusinessContent({ params }: Props) {
  const { id } = await params;
  const actor = await requireActor(`/business/${id}`);
  const { t } = await getServerI18n();

  const business = await getBusinessById(id);
  if (!business) notFound();

  // Verify access — resolves to not-found for non-members (admins bypass).
  const context = await resolveBusinessContext(actor, id).catch((error: unknown) => {
    if (error instanceof BusinessAccessError) notFound();
    throw error;
  });

  const verificationTone =
    business.verificationStatus === "verified"
      ? "success"
      : business.verificationStatus === "rejected"
        ? "danger"
        : "neutral";

  return (
    <PageShell className="max-w-3xl pt-10 sm:pt-14">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={verificationTone}>
          {t(`business.verification.${business.verificationStatus}`)}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">{business.businessCode}</span>
      </div>

      <h1 className="mt-4 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance">
        {business.name}
      </h1>

      {business.description ? (
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          {business.description}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link
          href={`/business/${id}/members`}
          className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
        >
          <Users className="size-5 text-muted-foreground group-hover:text-foreground" />
          <span className="text-sm font-medium">{t("business.nav.members")}</span>
        </Link>

        <Link
          href={`/business/${id}/roles`}
          className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
        >
          <Building2 className="size-5 text-muted-foreground group-hover:text-foreground" />
          <span className="text-sm font-medium">{t("business.nav.roles")}</span>
        </Link>

        {hasPermission(context, "subscription.manage") ? (
          <Link
            href={`/business/${id}/subscription`}
            className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
          >
            <CreditCard className="size-5 text-muted-foreground group-hover:text-foreground" />
            <span className="text-sm font-medium">{t("subscriptions.navLabel")}</span>
          </Link>
        ) : null}

        {hasPermission(context, "insights.read") ? (
          <Link
            href={`/business/${id}/insights`}
            className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
          >
            <Sparkles className="size-5 text-muted-foreground group-hover:text-foreground" />
            <span className="text-sm font-medium">{t("insights.navLabel")}</span>
          </Link>
        ) : null}

        {hasPermission(context, "installments.manage") ? (
          <Link
            href={`/business/${id}/installments`}
            className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
          >
            <CreditCard className="size-5 text-muted-foreground group-hover:text-foreground" />
            <span className="text-sm font-medium">{t("installments.navLabel")}</span>
          </Link>
        ) : null}

        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
          <GitBranch className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t("business.nav.branches")}</p>
            <p className="text-xs text-muted-foreground">
              {business.branches.length}{" "}
              {business.branches.length === 1
                ? t("business.nav.branch")
                : t("business.nav.branchPlural")}
            </p>
          </div>
        </div>
      </div>

      {business.branches.length > 0 ? (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("business.nav.branches")}
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {business.branches.map((branch) => (
              <li key={branch.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium">{branch.name}</span>
                  {branch.isPrimary ? (
                    <Badge tone="accent" className="ml-2">
                      {t("business.branches.primary")}
                    </Badge>
                  ) : null}
                  {branch.city ? (
                    <p className="text-xs text-muted-foreground">{branch.city}</p>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-muted-foreground">{branch.branchCode}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {business.contactPhone || business.contactEmail || business.website ? (
        <div className="mt-8 space-y-1 text-sm text-muted-foreground">
          {business.contactPhone ? <p>{business.contactPhone}</p> : null}
          {business.contactEmail ? <p>{business.contactEmail}</p> : null}
          {business.website ? (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              {business.website}
            </a>
          ) : null}
        </div>
      ) : null}

      <Button variant="secondary" size="sm" asChild className="mt-8">
        <Link href={`/business/${id}/members`}>{t("business.nav.manageMembers")}</Link>
      </Button>
    </PageShell>
  );
}

function BusinessSkeleton() {
  return (
    <PageShell className="max-w-3xl pt-10 sm:pt-14">
      <div role="status" aria-label="Loading the business">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-4 h-11 w-72 max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-lg" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <Skeleton className="mt-8 h-40 w-full rounded-lg" />
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
