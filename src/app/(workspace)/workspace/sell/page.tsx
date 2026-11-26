import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { GuidedListingFlow } from "@/components/workspace/guided-listing-flow";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { listBusinessesForUser } from "@/features/business/queries";
import { listStudioCategoryOptions } from "@/features/catalog/vendor-queries";
import { navFor } from "@/features/workspace/experience";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Sell something",
  description: "List a product in four short steps.",
  robots: { index: false, follow: false },
};

export default function SellPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <SellContent />
    </Suspense>
  );
}

async function SellContent() {
  const access = await requireStudioAccess("catalog.product.create", "/workspace/sell");
  const [{ t }, categories, memberships] = await Promise.all([
    getServerI18n(),
    listStudioCategoryOptions(),
    listBusinessesForUser(access.actor.id),
  ]);

  return (
    <WorkspaceShell
      businesses={memberships.map((membership) => ({
        id: membership.business.id,
        name: membership.business.name,
      }))}
      activeBusinessId={access.businessId}
      experiences={["seller"]}
      activeExperience="seller"
      nav={navFor("seller")}
    >
      <Link
        href="/workspace"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t("workspace.nav.home")}
      </Link>

      <div className="mt-3 border-b border-border pb-5">
        <p className="eyebrow text-muted-foreground">{t("workspace.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-medium tracking-[-0.035em] text-balance">
          {t("workspace.guide.title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("workspace.guide.intro")}
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="mt-5 rounded-xl border border-border bg-surface px-4 py-6 text-sm text-muted-foreground">
          {t("workspace.guide.noDepartments")}
        </p>
      ) : (
        <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <GuidedListingFlow categories={categories} />
        </div>
      )}
    </WorkspaceShell>
  );
}

function SellSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6"
      role="status"
      aria-label="Loading the listing flow"
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      <Skeleton className="mt-6 h-6 w-40" />
      <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-6 h-96 w-full max-w-2xl rounded-2xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
