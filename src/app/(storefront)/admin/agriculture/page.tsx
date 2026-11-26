import type { Metadata } from "next";

import { VerifyFarmerForm } from "@/components/agriculture/forms";
import { VerifySupplierForm } from "@/components/agriculture/supplier-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { isFeatureEnabled } from "@/features/flags/service";
import { listPendingFarmers } from "@/features/agriculture/queries";
import { listPendingSuppliers } from "@/features/agriculture/supplier-queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agriculture verification",
  robots: { index: false, follow: false },
};

export default async function AdminAgriculturePage() {
  await requireAdmin();
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [farmers, suppliers] = await Promise.all([listPendingFarmers(), listPendingSuppliers()]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Agriculture verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Farmers must be verified before they can publish produce listings or submit offers.
        </p>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}
      {farmers.map((farmer) => (
        <article
          key={farmer.id}
          className="space-y-2 rounded-xl border border-border bg-surface p-5 text-sm"
        >
          <p className="font-medium">
            {farmer.name} · {farmer.email}
          </p>
          <p className="text-xs text-muted-foreground">
            {[farmer.region, farmer.district].filter(Boolean).join(", ") || "Location not recorded"}
          </p>
          <VerifyFarmerForm farmerId={farmer.id} />
        </article>
      ))}
      {farmers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending farmers.</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Suppliers awaiting verification</h2>
        {suppliers.map((supplier) => (
          <article
            key={supplier.id}
            className="space-y-2 rounded-xl border border-border bg-surface p-5 text-sm"
          >
            <p className="font-medium">
              {supplier.businessName} · {supplier.type}
            </p>
            <p className="text-xs text-muted-foreground">
              {supplier.name} · {supplier.email}
            </p>
            <VerifySupplierForm supplierId={supplier.id} />
          </article>
        ))}
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending suppliers.</p>
        ) : null}
      </section>
    </PageShell>
  );
}
