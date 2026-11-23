import type { Metadata } from "next";
import { Suspense } from "react";
import { Users } from "lucide-react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerCard } from "@/features/crm/components/customer-card";
import { listStudioCustomers } from "@/features/crm/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default function StudioCustomersPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <StudioCustomersContent />
    </Suspense>
  );
}

async function StudioCustomersContent() {
  const access = await requireStudioAccess("crm.read", "/vendor/customers");
  const { t } = await getServerI18n();
  const customers = await listStudioCustomers(access.vendorId);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl tracking-tight">
          <Users className="size-6" aria-hidden="true" /> {t("crm.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("crm.subtitle")}</p>
      </header>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{t("crm.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("crm.emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {customers.map((customer) => (
            <CustomerCard key={customer.userId} customer={customer} />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
