import type { Metadata } from "next";
import Link from "next/link";

import {
  FarmForm,
  FarmerProfileForm,
  ListingForm,
  OfferForm,
  PlotForm,
} from "@/components/agriculture/forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { isFeatureEnabled } from "@/features/flags/service";
import {
  getFarmerSummary,
  listFarmerOffers,
  listOpenBuyerRequests,
  listContracts,
  listPublishedListings,
} from "@/features/agriculture/queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Farmer portal",
  robots: { index: false, follow: false },
};

export default async function FarmerPortalPage() {
  const actor = await requireActor("/agriculture/farmer");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [farmer, listings, requests] = await Promise.all([
    getFarmerSummary(actor.id),
    listPublishedListings(),
    listOpenBuyerRequests(),
  ]);
  const offers = farmer ? await listFarmerOffers(farmer.id) : [];
  const contracts = farmer ? await listContracts({ farmerId: farmer.id }) : [];

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Farmer portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your farm profile, plots and produce listings. Verification is required before
          publishing.
        </p>
        {farmer ? (
          <Badge tone={farmer.verificationStatus === "VERIFIED" ? "success" : "neutral"}>
            {farmer.verificationStatus}
          </Badge>
        ) : null}
        <Link href="/agriculture/farm-management" className="text-xs text-accent underline">
          Farm management
        </Link>
        <Link href="/agriculture/logistics" className="ml-3 text-xs text-accent underline">
          Logistics
        </Link>
        <Link href="/agriculture/groups" className="ml-3 text-xs text-accent underline">
          Groups
        </Link>
        <Link href="/agriculture/contracts" className="ml-3 text-xs text-accent underline">
          Contracts
        </Link>
      </header>

      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Farmer profile</h2>
        <div className="mt-4">
          <FarmerProfileForm />
        </div>
      </section>

      {farmer ? (
        <>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Farms and plots</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {farmer.farms.map((farm) => (
                <li key={farm.id}>
                  {farm.name} · {farm.sizeValue.toString()} {farm.sizeUnit}
                  <span className="block text-xs text-muted-foreground">
                    Plots: {farm.plots.map((plot) => plot.name).join(", ") || "none"}
                  </span>
                </li>
              ))}
              {farmer.farms.length === 0 ? (
                <li className="text-muted-foreground">No farms registered.</li>
              ) : null}
            </ul>
            <div className="mt-5 space-y-4 border-t border-border pt-5">
              <FarmForm />
              {farmer.farms.length > 0 ? (
                <PlotForm farms={farmer.farms.map((farm) => ({ id: farm.id, name: farm.name }))} />
              ) : null}
            </div>
          </section>

          {farmer.verificationStatus === "VERIFIED" ? (
            <section className="rounded-xl border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-medium">Produce listing</h2>
              <div className="mt-4">
                <ListingForm
                  farms={farmer.farms.map((farm) => ({ id: farm.id, name: farm.name }))}
                  plots={farmer.farms.flatMap((farm) =>
                    farm.plots.map((plot) => ({
                      id: plot.id,
                      name: `${farm.name} — ${plot.name}`,
                    })),
                  )}
                />
              </div>
              <div className="mt-4">
                <OfferForm
                  listings={listings.map((listing) => ({
                    id: listing.id,
                    cropName: listing.cropName,
                  }))}
                  requests={requests.map((request) => ({
                    id: request.id,
                    productName: request.productName,
                  }))}
                />
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <h2 className="font-display text-lg font-medium">My offers</h2>
            {offers.map((offer) => (
              <p key={offer.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                {offer.cropName} · {offer.quantity} {offer.unit} @ {offer.pricePerUnit}{" "}
                {offer.currency} · {offer.status}
              </p>
            ))}
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers yet.</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-medium">Contracts</h2>
            {contracts.map((contract) => (
              <p
                key={contract.id}
                className="rounded-lg border border-border bg-surface p-3 text-sm"
              >
                {contract.contractNumber} · {contract.total} {contract.currency} · {contract.status}
                {contract.paymentStatus ? ` · payment ${contract.paymentStatus}` : ""}
              </p>
            ))}
            {contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contracts yet.</p>
            ) : null}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
