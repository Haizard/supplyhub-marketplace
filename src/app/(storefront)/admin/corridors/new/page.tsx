import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { CorridorForm } from "@/components/admin/corridor-form";
import { listBusinessBranches } from "@/features/logistics-regional/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "New corridor",
  description: "Create a regional delivery corridor.",
  robots: { index: false, follow: false },
};

export default function NewCorridorPage() {
  return (
    <Suspense fallback={<NewCorridorSkeleton />}>
      <NewCorridorContent />
    </Suspense>
  );
}

async function NewCorridorContent() {
  await requireAdmin();
  const branches = await listBusinessBranches();

  return (
    <PageShell className="pt-10 sm:pt-14">
      <Link
        href="/admin/corridors"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Corridors
      </Link>

      <div className="mt-8 border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">New corridor</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          Create a corridor.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          Define a delivery route between two business branches with optional intermediate stops.
          The corridor starts as a draft and can be activated after review.
        </p>
      </div>

      <div className="mt-8 max-w-2xl rounded-xl border border-border bg-surface p-6 sm:p-8">
        <CorridorForm branches={branches} />
      </div>
    </PageShell>
  );
}

function NewCorridorSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading the corridor form">
        <div className="border-b border-border pb-8">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-12 w-80 max-w-full" />
        </div>
        <Skeleton className="mt-8 h-96 w-full max-w-2xl rounded-xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
