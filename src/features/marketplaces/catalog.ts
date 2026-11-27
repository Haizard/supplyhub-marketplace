/**
 * The marketplace switcher.
 *
 * SupplyHub runs several marketplaces on one account. This module is the single
 * list the switcher, the all-in-one hub and the navigation render from, so a new
 * network is added in one place. Labels are i18n keys, never English strings.
 */

export const MARKETPLACE_IDS = ["retail", "farm", "logistics", "services"] as const;

export type MarketplaceId = (typeof MARKETPLACE_IDS)[number];

export const ALL_MARKETPLACES_HREF = "/marketplaces";

export interface Marketplace {
  id: MarketplaceId;
  labelKey: string;
  bodyKey: string;
  href: string;
  /** Path prefixes that belong to this network, so the switcher can mark it. */
  matches: readonly string[];
}

export const MARKETPLACES: readonly Marketplace[] = [
  {
    id: "retail",
    labelKey: "marketplaces.retail",
    bodyKey: "marketplaces.retailBody",
    href: "/products",
    matches: ["/products", "/categories", "/search", "/vendors"],
  },
  {
    id: "farm",
    labelKey: "marketplaces.farm",
    bodyKey: "marketplaces.farmBody",
    href: "/agriculture/marketplace",
    matches: ["/agriculture"],
  },
  {
    id: "logistics",
    labelKey: "marketplaces.logistics",
    bodyKey: "marketplaces.logisticsBody",
    href: "/logistics",
    matches: ["/logistics"],
  },
  {
    id: "services",
    labelKey: "marketplaces.services",
    bodyKey: "marketplaces.servicesBody",
    href: "/services",
    matches: ["/services"],
  },
];

function normalize(pathname: string): string {
  const [path = ""] = pathname.split("?");
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function isAllMarketplacesPath(pathname: string): boolean {
  return normalize(pathname) === ALL_MARKETPLACES_HREF;
}

/** The network this path belongs to, or null for shared pages such as the cart. */
export function marketplaceForPath(pathname: string): MarketplaceId | null {
  const path = normalize(pathname);
  const match = MARKETPLACES.find((marketplace) =>
    marketplace.matches.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  );
  return match?.id ?? null;
}
