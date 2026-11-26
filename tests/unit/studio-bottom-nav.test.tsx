import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

// StudioBottomNav reads the current path via usePathname and its labels through the
// i18n context. I18nProvider calls next/navigation's useRouter, so stub both for
// jsdom. The provider defaults to English, matching the strings asserted below, and
// the fallback dictionary is the full English JSON so labels resolve on first render.
vi.mock("next/navigation", () => ({
  usePathname: () => "/vendor",
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { StudioBottomNav } from "@/components/vendor/studio-bottom-nav";
import { I18nProvider } from "@/i18n/client";

function renderNav(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("StudioBottomNav", () => {
  it("renders the seller navigation landmark", () => {
    renderNav(<StudioBottomNav />);

    expect(screen.getByRole("navigation", { name: "Studio navigation" })).toBeInTheDocument();
  });

  it("makes Overview a clickable link to the workspace and marks it current", () => {
    renderNav(<StudioBottomNav />);

    const overview = screen.getByRole("link", { name: "Overview" });
    expect(overview).toHaveAttribute("href", "/vendor");
    expect(overview).toHaveAttribute("aria-current", "page");
  });

  it("keeps the phone bar to four destinations plus More", () => {
    renderNav(<StudioBottomNav />);

    const nav = screen.getByRole("navigation", { name: "Studio navigation" });
    const links = within(nav).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Overview",
      "POS",
      "Products",
      "Orders",
    ]);
    expect(within(nav).getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("keeps every other studio destination reachable behind More", () => {
    renderNav(<StudioBottomNav />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    for (const [name, href] of [
      ["Inventory", "/vendor/inventory"],
      ["Returns", "/vendor/returns"],
      ["Messages", "/vendor/messages"],
      ["Customers", "/vendor/customers"],
      ["Wholesale", "/vendor/wholesale"],
      ["Deliveries", "/delivery/request"],
      ["Earnings", "/vendor/earnings"],
      ["Studio profile", "/vendor/profile"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("does not surface buyer shopping tabs", () => {
    renderNav(<StudioBottomNav />);

    expect(screen.queryByRole("link", { name: "Cart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Shop" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });
});
