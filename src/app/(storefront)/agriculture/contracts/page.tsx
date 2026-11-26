import type { Metadata } from "next";
import Link from "next/link";

import { AgreementDecisionForm, HarvestAgreementForm } from "@/components/agriculture/group-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { isFeatureEnabled } from "@/features/flags/service";
import { getDatabase } from "@/server/db/client";
import { listAllFarmers, listHarvestAgreements } from "@/features/agriculture/group-queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Harvest purchase agreements",
  robots: { index: false, follow: false },
};

export default async function HarvestContractsPage() {
  const actor = await requireActor("/agriculture/contracts");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [farmers, groups, agreements] = await Promise.all([
    listAllFarmers(),
    getActiveGroups(),
    listHarvestAgreements({ buyerUserId: actor.id }),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Harvest purchase agreements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agreed quantity, quality, pricing, delivery and variance terms are frozen at creation.
        </p>
        <Link href="/agriculture/groups" className="text-xs text-accent underline">
          Farmer groups
        </Link>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">New agreement</h2>
        <div className="mt-4">
          <HarvestAgreementForm farmers={farmers} groups={groups} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">My agreements</h2>
        {agreements.map((agreement) => (
          <div
            key={agreement.id}
            className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm"
          >
            <p>
              {agreement.agreementNumber} · {agreement.cropName} · {agreement.expectedQuantity}{" "}
              {agreement.unit}
              {agreement.groupName ? ` · ${agreement.groupName}` : ""} · {agreement.status}
            </p>
            <p className="text-xs text-muted-foreground">
              Payment {agreement.paymentStatus ?? "not started"}
              {agreement.deliveredQuantity
                ? ` · delivered ${agreement.deliveredQuantity} ${agreement.unit}`
                : ""}
            </p>
            <AgreementDecisionForm agreementId={agreement.id} status={agreement.status} />
          </div>
        ))}
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agreements yet.</p>
        ) : null}
      </section>
    </PageShell>
  );
}

async function getActiveGroups() {
  return getDatabase().farmerGroup.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true },
  });
}
