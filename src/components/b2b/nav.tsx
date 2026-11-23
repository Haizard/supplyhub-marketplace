"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

const buyerTabs = [
  { href: "/b2b", key: "b2b.title", exact: true },
  { href: "/b2b/wholesale", key: "b2b.catalog" },
  { href: "/b2b/rfq", key: "b2b.rfqs" },
  { href: "/b2b/purchase-orders", key: "b2b.purchaseOrders" },
  { href: "/b2b/invoices", key: "b2b.invoices" },
] as const;

const sellerTabs = [
  { href: "/vendor/wholesale", key: "b2b.listings" },
  { href: "/vendor/rfq", key: "b2b.rfqs" },
  { href: "/vendor/purchase-orders", key: "b2b.purchaseOrders" },
  { href: "/vendor/invoices", key: "b2b.invoices" },
] as const;

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-accent-soft font-medium text-foreground"
          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function BuyerNav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav
      aria-label={t("b2b.title")}
      className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1"
    >
      {buyerTabs.map((tab) => (
        <TabLink
          key={tab.href}
          href={tab.href}
          label={t(tab.key)}
          active={
            "exact" in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
          }
        />
      ))}
    </nav>
  );
}

export function SellerB2bNav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav
      aria-label={t("b2b.title")}
      className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1"
    >
      {sellerTabs.map((tab) => (
        <TabLink
          key={tab.href}
          href={tab.href}
          label={t(tab.key)}
          active={pathname.startsWith(tab.href)}
        />
      ))}
    </nav>
  );
}
