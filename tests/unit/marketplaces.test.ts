import { describe, expect, it } from "vitest";

import {
  ALL_MARKETPLACES_HREF,
  MARKETPLACES,
  isAllMarketplacesPath,
  marketplaceForPath,
} from "@/features/marketplaces/catalog";

describe("marketplace switcher", () => {
  it("marks the network a page belongs to", () => {
    expect(marketplaceForPath("/products")).toBe("retail");
    expect(marketplaceForPath("/products/ridge-carafe")).toBe("retail");
    expect(marketplaceForPath("/categories/ceramics")).toBe("retail");
    expect(marketplaceForPath("/agriculture/marketplace")).toBe("farm");
    expect(marketplaceForPath("/agriculture/farm-management")).toBe("farm");
    expect(marketplaceForPath("/logistics")).toBe("logistics");
    expect(marketplaceForPath("/logistics/abc/jobs")).toBe("logistics");
    expect(marketplaceForPath("/services/abc")).toBe("services");
  });

  it("leaves shared pages without a network, and knows the all-in-one hub", () => {
    expect(marketplaceForPath("/")).toBeNull();
    expect(marketplaceForPath("/cart")).toBeNull();
    expect(marketplaceForPath("/account/orders")).toBeNull();

    expect(isAllMarketplacesPath(ALL_MARKETPLACES_HREF)).toBe(true);
    expect(isAllMarketplacesPath(`${ALL_MARKETPLACES_HREF}/`)).toBe(true);
    expect(isAllMarketplacesPath("/products")).toBe(false);
  });

  it("offers one entry per network with unique destinations", () => {
    const hrefs = MARKETPLACES.map((marketplace) => marketplace.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
    expect(MARKETPLACES.every((marketplace) => marketplace.matches.length > 0)).toBe(true);
  });
});
