"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ALL_MARKETPLACES_HREF,
  MARKETPLACES,
  isAllMarketplacesPath,
  marketplaceForPath,
} from "@/features/marketplaces/catalog";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

import { PageShell } from "./page-shell";

/** Checkout and authentication are single-purpose screens, so the switcher stays out of them. */
const HIDDEN_PREFIXES = ["/sign-in", "/sign-up", "/checkout", "/admin"];

const chipClassName =
  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export function MarketplaceSwitcher() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (
    !pathname ||
    HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return null;
  }

  const activeMarketplace = marketplaceForPath(pathname);
  const allActive = isAllMarketplacesPath(pathname);

  const items = [
    { id: "all", href: ALL_MARKETPLACES_HREF, label: t("marketplaces.all"), active: allActive },
    ...MARKETPLACES.map((marketplace) => ({
      id: marketplace.id,
      href: marketplace.href,
      label: t(marketplace.labelKey),
      active: activeMarketplace === marketplace.id,
    })),
  ];

  return (
    <nav
      aria-label={t("marketplaces.switcherLabel")}
      className="border-b border-border bg-surface/50"
    >
      <PageShell className="flex [scrollbar-width:none] items-center gap-2 overflow-x-auto py-2.5 [&::-webkit-scrollbar]:hidden">
        <span className="eyebrow mr-1 shrink-0 text-muted-foreground">
          {t("marketplaces.switcherLabel")}
        </span>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              chipClassName,
              item.active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </PageShell>
    </nav>
  );
}
