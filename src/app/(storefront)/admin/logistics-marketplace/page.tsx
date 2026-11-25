import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ExpireOpportunitiesForm,
  OfferForm,
  AutoOfferForm,
  OpportunityForm,
} from "@/components/logistics/marketplace-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listOfferedOpportunities,
  listOpenOpportunities,
  getOpportunityScores,
} from "@/features/logistics-marketplace/queries";
import { getDatabase } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Logistics dispatch marketplace",
  robots: { index: false, follow: false },
};

export default function AdminLogisticsMarketplacePage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AdminLogisticsMarketplaceContent />
    </Suspense>
  );
}

async function AdminLogisticsMarketplaceContent() {
  await requireAdmin();
  const [open, offered] = await Promise.all([listOpenOpportunities(), listOfferedOpportunities()]);
  const requests = await getDatabase().deliveryRequest.findMany({
    where: { status: "PENDING", source: "PLATFORM" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, requestNumber: true, pickupName: true, dropoffName: true },
  });
  const scoresByOpportunity = await Promise.all(
    open.map((opportunity) => getOpportunityScores(opportunity.id)),
  );

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Logistics marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish platform deliveries and offer them only to verified, eligible companies.
          </p>
        </div>
        <ExpireOpportunitiesForm />
      </header>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Publish an opportunity</h2>
        <div className="mt-4">
          <OpportunityForm
            requestIds={requests.map((request) => ({
              id: request.id,
              label: `${request.requestNumber} · ${request.pickupName} → ${request.dropoffName}`,
            }))}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Open opportunities</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open opportunities.</p>
        ) : (
          open.map((opportunity, index) => (
            <div
              key={opportunity.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-medium">{opportunity.opportunityNumber}</p>
                  <p className="text-sm">
                    {opportunity.pickupName} → {opportunity.dropoffName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {opportunity.distanceKm} km · {opportunity.fee} {opportunity.currency} ·{" "}
                    {opportunity.vehicleType ?? "any vehicle"}
                  </p>
                </div>
                <Badge tone="neutral">{opportunity.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <AutoOfferForm opportunityId={opportunity.id} />
                <OfferForm
                  opportunityId={opportunity.id}
                  companies={(scoresByOpportunity[index] ?? []).map((score) => ({
                    id: score.companyId,
                    name: score.companyName,
                    score: score.score,
                    eligible: score.eligible,
                  }))}
                />
              </div>
              {scoresByOpportunity[index]?.length ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {scoresByOpportunity[index].map((score) => (
                    <li key={score.id}>
                      #{score.rank ?? "—"} {score.companyName} · score {score.score} · eligible{" "}
                      {score.eligible ? "yes" : "no"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Offers awaiting response</h2>
        {offered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending offers.</p>
        ) : (
          offered.map((opportunity) => (
            <div
              key={opportunity.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <p className="font-mono text-sm font-medium">{opportunity.opportunityNumber}</p>
                <p className="text-xs text-muted-foreground">
                  Offered to {opportunity.offeredToName ?? "—"} · expires{" "}
                  {new Date(opportunity.expiresAt).toLocaleString()}
                </p>
              </div>
              <Badge tone="neutral">{opportunity.status}</Badge>
            </div>
          ))
        )}
      </section>
    </PageShell>
  );
}
