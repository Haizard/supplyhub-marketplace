import type { Metadata } from "next";

import { BuyerRequestForm, DecideOfferForm } from "@/components/agriculture/forms";
import { ConsolePageHeader } from "@/components/console/console-ui";
import { isFeatureEnabled } from "@/features/flags/service";
import {
  listBuyerOffers,
  listContracts,
  listOpenBuyerRequests,
  listPublishedListings,
} from "@/features/agriculture/queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agricultural buyer portal",
  robots: { index: false, follow: false },
};

export default async function AgricultureBuyerPage() {
  const actor = await requireActor("/agriculture/buyers");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [listings, requests, offers, contracts] = await Promise.all([
    listPublishedListings(),
    listOpenBuyerRequests(),
    listBuyerOffers(actor.id),
    listContracts({ buyerUserId: actor.id }),
  ]);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Agricultural buyer portal"
        description="Publish bulk requirements, review farmer offers and pay through the shared verified payment flow."
      />
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">New bulk request</h2>
        <div className="mt-4">
          <BuyerRequestForm />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Offers awaiting your decision</h2>
        {offers.map((offer) => (
          <article
            key={offer.id}
            className="space-y-2 rounded-xl border border-border bg-surface p-5 text-sm"
          >
            <p>
              {offer.cropName} · {offer.quantity} {offer.unit} @ {offer.pricePerUnit}{" "}
              {offer.currency}
            </p>
            <DecideOfferForm offerId={offer.id} />
          </article>
        ))}
        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending offers.</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Contracts and payment</h2>
        {contracts.map((contract) => (
          <p key={contract.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            {contract.contractNumber} · {contract.total} {contract.currency} · {contract.status}
            {contract.orderNumber ? ` · order ${contract.orderNumber}` : ""}
            {contract.paymentStatus ? ` · payment ${contract.paymentStatus}` : ""}
          </p>
        ))}
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contracts yet.</p>
        ) : null}
      </section>

      <p className="text-xs text-muted-foreground">
        Published listings available: {listings.length}. Open buyer requests: {requests.length}.
      </p>
    </div>
  );
}
