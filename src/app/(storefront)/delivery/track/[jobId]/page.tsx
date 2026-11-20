import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/storefront/page-shell";
import { LiveTracking } from "@/components/logistics/live-tracking";

export const metadata: Metadata = {
  title: "Live delivery tracking",
  robots: { index: false, follow: false },
};

export default async function TrackDeliveryPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <p className="eyebrow text-muted-foreground">Live tracking</p>
        <h1 className="mt-3 font-display text-3xl leading-none font-medium tracking-[-0.04em] sm:text-4xl">
          Follow your delivery
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Position and status come from the courier&apos;s app, not a simulation.
        </p>
      </header>

      <LiveTracking jobId={jobId} />

      <Link href="/delivery/request" className="inline-block text-sm underline underline-offset-2">
        Back to delivery requests
      </Link>
    </PageShell>
  );
}
