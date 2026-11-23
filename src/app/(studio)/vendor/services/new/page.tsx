import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ServiceListingForm } from "@/components/vendor/service-listing-form";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "New service",
  robots: { index: false, follow: false },
};

export default function NewServicePage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <NewServiceContent />
    </Suspense>
  );
}

async function NewServiceContent() {
  const access = await requireStudioAccess("services.manage", "/vendor/services/new");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase7.servicesMarketplace");

  return (
    <PageShell className="space-y-6 py-8">
      <Link href="/vendor/services" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("services.title")}
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("services.newListing")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listings publish immediately and appear in the marketplace.
        </p>
      </header>

      {enabled ? (
        <div className="max-w-2xl rounded-xl border border-border bg-surface p-6">
          <ServiceListingForm vendorId={access.vendorId} />
        </div>
      ) : (
        <EmptyState title="Coming soon" description={t("services.comingSoon")} />
      )}
    </PageShell>
  );
}
