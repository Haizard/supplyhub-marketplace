import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listBusinessesForUser } from "@/features/business/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Your businesses",
  robots: { index: false, follow: false },
};

export default function BusinessesPage() {
  return (
    <Suspense fallback={<BusinessesSkeleton />}>
      <BusinessesContent />
    </Suspense>
  );
}

async function BusinessesContent() {
  const actor = await requireActor("/business");
  const { t } = await getServerI18n();
  const memberships = await listBusinessesForUser(actor.id);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow text-muted-foreground">SupplyHub</p>
          <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
            {t("business.index.heading")}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("business.index.lead")}
          </p>
        </div>
        <Button asChild variant="accent" size="md" className="w-fit">
          <Link href="/business/new">{t("business.index.create")}</Link>
        </Button>
      </div>

      {memberships.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
          <Building2 className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {t("business.index.emptyBody")}
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-5 w-fit">
            <Link href="/business/new">{t("business.index.create")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
          {memberships.map((membership) => (
            <li key={membership.id}>
              <Link
                href={`/business/${membership.business.id}`}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{membership.business.name}</p>
                  <p className="mt-1 font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground uppercase">
                    {membership.business.businessCode}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {membership.roles.map((entry) => entry.role.name).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    tone={
                      membership.business.verificationStatus === "verified" ? "success" : "neutral"
                    }
                  >
                    {t(`business.verification.${membership.business.verificationStatus}`)}
                  </Badge>
                  <span className="text-xs font-medium text-accent">
                    {t("business.index.open")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function BusinessesSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading your businesses">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-4 h-12 w-72 max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-lg" />
        <Skeleton className="mt-10 h-64 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
