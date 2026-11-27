import type { Metadata } from "next";
import { ArrowRight, ShoppingBag, Sparkles, Sprout, Truck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listOpenBuyerRequests, listPublishedListings } from "@/features/agriculture/queries";
import { listProductPage } from "@/features/catalog/queries";
import { isFeatureEnabled } from "@/features/flags/service";
import { listPublicLogisticsCompanies } from "@/features/logistics-companies/queries";
import type { MarketplaceId } from "@/features/marketplaces/catalog";
import { listActiveServiceListings } from "@/features/services/queries";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "All marketplaces",
  description:
    "Retail objects, farm produce, delivery companies and services — every SupplyHub network in one place, or one at a time.",
  alternates: { canonical: "/marketplaces" },
};

const ICONS = {
  retail: ShoppingBag,
  farm: Sprout,
  logistics: Truck,
  services: Sparkles,
} as const;

export default function MarketplacesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <MarketplacesContent />
    </Suspense>
  );
}

interface MarketplaceCard {
  id: MarketplaceId;
  title: string;
  body: string;
  href: string;
  metric: string;
  samples: { label: string; href: string }[];
  closed: boolean;
}

async function MarketplacesContent() {
  const [{ t }, retail, listings, requests, companies, services, farmOpen, logisticsOpen] =
    await Promise.all([
      getServerI18n(),
      listProductPage({}),
      listPublishedListings(),
      listOpenBuyerRequests(),
      listPublicLogisticsCompanies(),
      listActiveServiceListings(),
      isFeatureEnabled("phase11.agricultureNetwork"),
      isFeatureEnabled("phase9.logisticsNetwork"),
    ]);

  const cards: MarketplaceCard[] = [
    {
      id: "retail",
      title: t("marketplaces.retail"),
      body: t("marketplaces.retailBody"),
      href: "/products",
      metric: t("marketplaces.allObjects", { count: retail.total }),
      samples: retail.items
        .slice(0, 3)
        .map((product) => ({ label: product.name, href: `/products/${product.slug}` })),
      closed: false,
    },
    {
      id: "farm",
      title: t("marketplaces.farm"),
      body: t("marketplaces.farmBody"),
      href: "/agriculture/marketplace",
      metric: `${t("marketplaces.allListings", { count: listings.length })} · ${t(
        "marketplaces.allRequests",
        {
          count: requests.length,
        },
      )}`,
      samples: listings.slice(0, 3).map((listing) => ({
        label: `${listing.cropName}${listing.variety ? ` · ${listing.variety}` : ""}`,
        href: "/agriculture/marketplace",
      })),
      closed: !farmOpen,
    },
    {
      id: "logistics",
      title: t("marketplaces.logistics"),
      body: t("marketplaces.logisticsBody"),
      href: "/logistics",
      metric: t("marketplaces.allCompanies", { count: companies.length }),
      samples: companies
        .slice(0, 3)
        .map((company) => ({ label: company.name, href: "/logistics" })),
      closed: !logisticsOpen,
    },
    {
      id: "services",
      title: t("marketplaces.services"),
      body: t("marketplaces.servicesBody"),
      href: "/services",
      metric: t("marketplaces.allServices", { count: services.length }),
      samples: services
        .slice(0, 3)
        .map((service) => ({ label: service.title, href: `/services/${service.id}` })),
      closed: false,
    },
  ];

  return (
    <PageShell className="py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="eyebrow text-muted-foreground">{t("marketplaces.oneAccount")}</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          {t("marketplaces.allTitle")}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("marketplaces.allBody")}</p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = ICONS[card.id];
          return (
            <section
              key={card.id}
              aria-labelledby={`marketplace-${card.id}`}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-muted text-foreground">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h2
                    id={`marketplace-${card.id}`}
                    className="font-display text-xl font-semibold tracking-[-0.02em]"
                  >
                    {card.title}
                  </h2>
                </div>
                {card.closed ? <Badge tone="neutral">{t("marketplaces.closed")}</Badge> : null}
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.body}</p>
              <p className="mt-3 font-mono text-xs font-medium text-foreground">{card.metric}</p>

              <ul className="mt-3 flex-1 space-y-1.5">
                {card.samples.length > 0 ? (
                  card.samples.map((sample) => (
                    <li key={`${sample.href}-${sample.label}`}>
                      <Link
                        href={sample.href}
                        className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="truncate">{sample.label}</span>
                        <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">{t("marketplaces.empty")}</li>
                )}
              </ul>

              <Link
                href={card.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                {t("marketplaces.openNamed", { marketplace: card.title })}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
