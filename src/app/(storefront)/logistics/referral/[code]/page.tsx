import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicReferral } from "@/features/partner-growth/actions";
import { isFeatureEnabled } from "@/features/flags/service";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Partner referral",
  robots: { index: false, follow: false },
};

export default function PublicReferralPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <PublicReferralContent params={params} />
    </Suspense>
  );
}

async function PublicReferralContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const actor = await requireActor(`/logistics/referral/${code}`);
  const enabled = await isFeatureEnabled("phase9.logisticsNetwork");
  const referral = enabled ? await getPublicReferral(code) : null;
  if (!referral) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <Badge tone="success">Verified referral partner</Badge>
        <h1 className="mt-3 font-display text-3xl tracking-tight">{referral.companyName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {referral.city ?? "Tanzania"} · referral {referral.code}
        </p>
      </header>
      {referral.description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{referral.description}</p>
      ) : null}
      <section className="max-w-xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Register your business</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this referral when you register so {referral.companyName} can support your deliveries.
        </p>
        <p className="mt-4 font-mono text-sm">Referral code: {referral.code}</p>
        <p className="mt-1 text-xs text-muted-foreground">Signed in as {actor.email}</p>
      </section>
    </PageShell>
  );
}
