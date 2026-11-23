import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FeatureFlagForm,
  FeatureFlagToggle,
} from "@/features/flags/components/feature-flag-controls";
import { listFeatureFlags } from "@/features/flags/service";
import { getServerI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Feature flags",
  robots: { index: false, follow: false },
};

export default function AdminFeatureFlagsPage() {
  return (
    <Suspense fallback={<FeatureFlagsSkeleton />}>
      <FeatureFlagsContent />
    </Suspense>
  );
}

async function FeatureFlagsContent() {
  const [admin, flags, { t }] = await Promise.all([
    requireAdmin(),
    listFeatureFlags(),
    getServerI18n(),
  ]);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">Administration</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em]">
          Phase 7 feature flags
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Roll out ecosystem features deliberately. Every change writes a transactional outbox event
          and an audit record.
        </p>
        <p className="mt-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
          {t("admin.signedInAs", { name: admin.name })}
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="feature-flags-heading">
          <h2 id="feature-flags-heading" className="font-display text-xl font-medium">
            Flags
          </h2>
          {flags.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No feature flags yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {flags.map((flag) => (
                <li key={flag.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{flag.name}</span>
                        <Badge tone={flag.enabled ? "success" : "neutral"}>
                          {flag.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{flag.key}</p>
                      {flag.description ? (
                        <p className="mt-2 text-sm text-muted-foreground">{flag.description}</p>
                      ) : null}
                    </div>
                    <FeatureFlagToggle flag={flag} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="create-flag-heading">
          <h2 id="create-flag-heading" className="font-display text-xl font-medium">
            Create flag
          </h2>
          <div className="mt-4">
            <FeatureFlagForm />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function FeatureFlagsSkeleton() {
  return (
    <PageShell className="space-y-6 py-10" role="status" aria-label="Loading feature flags">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-64 w-full" />
    </PageShell>
  );
}
