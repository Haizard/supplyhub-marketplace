import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformAnalytics } from "@/features/analytics/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Platform analytics",
  robots: { index: false, follow: false },
};

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AdminAnalyticsContent />
    </Suspense>
  );
}

async function AdminAnalyticsContent() {
  await requireAdmin();
  const analytics = await getPlatformAnalytics();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Platform analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregate metrics read directly from their source tables.
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(analytics).map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border bg-surface p-5">
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 font-display text-2xl tracking-tight">{metric.value}</dd>
            <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">{metric.source}</p>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
