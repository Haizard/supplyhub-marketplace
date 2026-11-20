import type { Metadata } from "next";
import { Suspense } from "react";

import { CreateBusinessForm } from "@/components/business/create-business-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Register a business",
  robots: { index: false, follow: false },
};

export default function NewBusinessPage() {
  return (
    <Suspense fallback={<NewBusinessSkeleton />}>
      <NewBusinessContent />
    </Suspense>
  );
}

async function NewBusinessContent() {
  await requireActor("/business/new");
  const { t } = await getServerI18n();

  return (
    <PageShell className="max-w-xl pt-10 sm:pt-14">
      <p className="eyebrow text-muted-foreground">SupplyHub</p>
      <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance">
        {t("business.new.heading")}
      </h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("business.new.lead")}</p>

      <div className="mt-8 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <CreateBusinessForm />
      </div>
    </PageShell>
  );
}

function NewBusinessSkeleton() {
  return (
    <PageShell className="max-w-xl pt-10 sm:pt-14">
      <div role="status" aria-label="Loading the business form">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-4 h-10 w-64 max-w-full" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-8 h-96 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
