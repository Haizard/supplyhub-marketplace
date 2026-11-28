import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { agricultureSectionGroups } from "@/components/agriculture/agriculture-sections";
import { ConsolePageHeader, ConsoleSection, ConsoleStat } from "@/components/console/console-ui";
import {
  FarmForm,
  FarmerProfileForm,
  ListingForm,
  OfferForm,
  PlotForm,
} from "@/components/agriculture/forms";
import { Button } from "@/components/ui/button";
import { isFeatureEnabled } from "@/features/flags/service";
import {
  getFarmerSummary,
  listFarmerOffers,
  listOpenBuyerRequests,
  listContracts,
  listPublishedListings,
} from "@/features/agriculture/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Farmer portal",
  robots: { index: false, follow: false },
};

export default async function FarmerPortalPage() {
  const actor = await requireActor("/agriculture/farmer");
  const { t } = await getServerI18n();
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [farmer, listings, requests] = await Promise.all([
    getFarmerSummary(actor.id),
    listPublishedListings(),
    listOpenBuyerRequests(),
  ]);
  const offers = farmer ? await listFarmerOffers(farmer.id) : [];
  const contracts = farmer ? await listContracts({ farmerId: farmer.id }) : [];

  const farms = farmer?.farms ?? [];
  const plots = farms.reduce((total, farm) => total + farm.plots.length, 0);
  const liveListings = farmer?.listings.filter((listing) => listing.status === "PUBLISHED") ?? [];
  const verified = farmer?.verificationStatus === "VERIFIED";
  const pendingOffers = offers.filter((offer) => offer.status === "PENDING").length;

  const steps = [
    !farmer || !verified
      ? {
          title: t("agriculture.overview.attention.verifyTitle"),
          body: t("agriculture.overview.attention.verifyBody"),
          href: "#profile",
          action: t("agriculture.overview.attention.verifyAction"),
        }
      : null,
    farms.length === 0
      ? {
          title: t("agriculture.overview.attention.farmTitle"),
          body: t("agriculture.overview.attention.farmBody"),
          href: "#farms",
          action: t("agriculture.overview.attention.farmAction"),
        }
      : null,
    liveListings.length === 0
      ? {
          title: t("agriculture.overview.attention.listingTitle"),
          body: t("agriculture.overview.attention.listingBody"),
          href: "#produce",
          action: t("agriculture.overview.attention.listingAction"),
        }
      : null,
  ].filter((step): step is NonNullable<typeof step> => step !== null);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t("agriculture.overview.eyebrow")}
        title={t("agriculture.overview.title")}
        description={t("agriculture.overview.description")}
        actions={
          <Button asChild size="sm">
            <Link href="#produce">
              {t("agriculture.overview.newListing")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ConsoleStat
          label={t("agriculture.overview.stats.farms")}
          value={farms.length}
          hint={t("agriculture.overview.stats.farmsHint")}
          href="#farms"
        />
        <ConsoleStat
          label={t("agriculture.overview.stats.plots")}
          value={plots}
          hint={t("agriculture.overview.stats.plotsHint")}
          href="#farms"
        />
        <ConsoleStat
          label={t("agriculture.overview.stats.listings")}
          value={liveListings.length}
          hint={t("agriculture.overview.stats.listingsHint")}
          href="#produce"
        />
        <ConsoleStat
          label={t("agriculture.overview.stats.offers")}
          value={pendingOffers}
          hint={t("agriculture.overview.stats.offersHint")}
          href="#offers"
          tone={pendingOffers > 0 ? "warning" : "neutral"}
        />
      </div>

      <ConsoleSection
        title={t("agriculture.overview.attention.title")}
        description={t("agriculture.overview.attention.body")}
      >
        {steps.length > 0 ? (
          <ul className="divide-y divide-border">
            {steps.map((step) => (
              <li
                key={step.title}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.body}</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href={step.href}>
                    {step.action}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {t("agriculture.overview.attention.empty")}
          </p>
        )}
      </ConsoleSection>

      <div id="profile" className="scroll-mt-32">
        <ConsoleSection
          title={t("agriculture.overview.profile.title")}
          description={t("agriculture.overview.profile.body")}
        >
          <FarmerProfileForm />
        </ConsoleSection>
      </div>

      {farmer ? (
        <>
          <div id="farms" className="scroll-mt-32">
            <ConsoleSection
              title={t("agriculture.overview.farms.title")}
              description={t("agriculture.overview.farms.body")}
            >
              <ul className="space-y-2 text-sm">
                {farmer.farms.map((farm) => (
                  <li key={farm.id} className="border-b border-border/50 pb-2 last:border-b-0">
                    <span className="font-medium">{farm.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {farm.sizeValue.toString()} {farm.sizeUnit}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("agriculture.overview.farms.plots")}:{" "}
                      {farm.plots.map((plot) => plot.name).join(", ") ||
                        t("agriculture.overview.farms.noPlots")}
                    </span>
                  </li>
                ))}
                {farmer.farms.length === 0 ? (
                  <li className="text-muted-foreground">{t("agriculture.overview.farms.empty")}</li>
                ) : null}
              </ul>
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <FarmForm />
                {farmer.farms.length > 0 ? (
                  <PlotForm
                    farms={farmer.farms.map((farm) => ({ id: farm.id, name: farm.name }))}
                  />
                ) : null}
              </div>
            </ConsoleSection>
          </div>

          {verified ? (
            <div id="produce" className="scroll-mt-32 space-y-4">
              <ConsoleSection
                title={t("agriculture.overview.produce.title")}
                description={t("agriculture.overview.produce.body")}
              >
                <ListingForm
                  farms={farmer.farms.map((farm) => ({ id: farm.id, name: farm.name }))}
                  plots={farmer.farms.flatMap((farm) =>
                    farm.plots.map((plot) => ({
                      id: plot.id,
                      name: `${farm.name} — ${plot.name}`,
                    })),
                  )}
                />
              </ConsoleSection>

              <ConsoleSection
                title={t("agriculture.overview.offer.title")}
                description={t("agriculture.overview.offer.body")}
              >
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
              </ConsoleSection>
            </div>
          ) : null}

          <div id="offers" className="scroll-mt-32">
            <ConsoleSection
              title={t("agriculture.overview.offers.title")}
              description={t("agriculture.overview.offers.body")}
            >
              {offers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("agriculture.overview.offers.empty")}
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {offers.map((offer) => (
                    <li key={offer.id} className="border-b border-border/50 pb-2 last:border-b-0">
                      <span className="font-medium">{offer.cropName}</span> · {offer.quantity}{" "}
                      {offer.unit} @ {offer.pricePerUnit} {offer.currency}
                      <span className="ml-2 text-xs text-muted-foreground">{offer.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ConsoleSection>
          </div>

          <ConsoleSection
            title={t("agriculture.overview.contracts.title")}
            description={t("agriculture.overview.contracts.body")}
          >
            {contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("agriculture.overview.contracts.empty")}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contracts.map((contract) => (
                  <li key={contract.id} className="border-b border-border/50 pb-2 last:border-b-0">
                    <span className="font-mono text-xs">{contract.contractNumber}</span> ·{" "}
                    {contract.total} {contract.currency}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {contract.status}
                      {contract.paymentStatus ? ` · payment ${contract.paymentStatus}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ConsoleSection>
        </>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-medium">
            {t("agriculture.overview.modules.title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("agriculture.overview.modules.body")}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agricultureSectionGroups.map((group) => (
            <div key={group.key} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-mono text-[0.5625rem] tracking-[0.16em] text-muted-foreground uppercase">
                {t(`agriculture.console.groups.${group.key}`)}
              </p>
              <ul className="mt-2.5 space-y-0.5">
                {group.items.map((section) => (
                  <li key={section.key}>
                    <Link
                      href={section.href}
                      className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      <section.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {t(`agriculture.console.nav.${section.key}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
