import type { Metadata } from "next";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { isFeatureEnabled } from "@/features/flags/service";
import { listOpenBuyerRequests, listPublishedListings } from "@/features/agriculture/queries";

export const metadata: Metadata = {
  title: "Agricultural marketplace",
  robots: { index: false, follow: false },
};

export default async function AgricultureMarketplacePage() {
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [listings, requests] = await Promise.all([
    listPublishedListings(),
    listOpenBuyerRequests(),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Agricultural marketplace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produce listings and bulk buyer requests. Claims are seller-declared until independently
          verified.
        </p>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Produce listings</h2>
        {listings.map((listing) => (
          <article
            key={listing.id}
            className="space-y-2 rounded-xl border border-border bg-surface p-5 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {listing.cropName} {listing.variety ? `· ${listing.variety}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {listing.quantity} {listing.unit} @ {listing.pricePerUnit} {listing.currency} ·
                  minimum {listing.minimumOrder} {listing.unit}
                </p>
                <p className="text-xs text-muted-foreground">
                  {listing.grade ? `Grade ${listing.grade} · ` : ""}
                  {listing.collectionLocation} · seller {listing.farmerName} (
                  {listing.verificationStatus})
                </p>
              </div>
              <Badge tone={listing.verificationStatus === "VERIFIED" ? "success" : "neutral"}>
                {listing.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {listing.deliveryAvailable ? "Delivery available" : "Collection only"}
              {listing.organicClaim ? " · organic claim (unverified)" : ""}
              {listing.certifiedClaim ? " · certified claim (unverified)" : ""}
            </p>
          </article>
        ))}
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published listings.</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Bulk buyer requests</h2>
        {requests.map((request) => (
          <article
            key={request.id}
            className="rounded-xl border border-border bg-surface p-5 text-sm"
          >
            <p className="font-medium">{request.productName}</p>
            <p className="text-xs text-muted-foreground">
              {request.quantity} {request.unit} · {request.deliveryLocation} · delivery by{" "}
              {new Date(request.deliveryDeadline).toLocaleDateString()} · offers by{" "}
              {new Date(request.offerDeadline).toLocaleDateString()}
            </p>
            {request.qualitySpec ? <p className="mt-1 text-xs">{request.qualitySpec}</p> : null}
          </article>
        ))}
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open buyer requests.</p>
        ) : null}
      </section>
    </PageShell>
  );
}
