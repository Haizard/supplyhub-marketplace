"use client";

import {
  Building2,
  Calculator,
  LayoutDashboard,
  MessageSquare,
  Package,
  ReceiptText,
  RotateCcw,
  Truck,
  UserRound,
  Wallet,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

// Shared by the desktop sidebar (StudioSidebar) and the mobile bottom bar
// (StudioBottomNav) so both stay in sync. Overview is always first and clickable.
export const studioTabs = [
  {
    href: "/vendor",
    labelKey: "studio.overview",
    icon: LayoutDashboard,
    active: (pathname: string) => pathname === "/vendor",
  },
  {
    href: "/vendor/pos",
    labelKey: "studio.pos",
    mobileLabelKey: "studio.posShort",
    icon: Calculator,
    active: (pathname: string) => pathname.startsWith("/vendor/pos"),
  },
  {
    href: "/vendor/products",
    labelKey: "studio.products",
    icon: Package,
    active: (pathname: string) => pathname.startsWith("/vendor/products"),
  },
  {
    href: "/vendor/inventory",
    labelKey: "inventory.tab",
    mobileLabelKey: "inventory.tabShort",
    icon: Warehouse,
    active: (pathname: string) =>
      pathname.startsWith("/vendor/inventory") || pathname.startsWith("/vendor/warehouses"),
  },
  {
    href: "/vendor/orders",
    labelKey: "studio.orders",
    icon: ReceiptText,
    active: (pathname: string) => pathname.startsWith("/vendor/orders"),
  },
  {
    href: "/vendor/returns",
    labelKey: "studio.returns",
    icon: RotateCcw,
    active: (pathname: string) => pathname.startsWith("/vendor/returns"),
  },
  {
    href: "/vendor/messages",
    labelKey: "studio.messages",
    mobileLabelKey: "studio.messagesShort",
    icon: MessageSquare,
    active: (pathname: string) => pathname.startsWith("/vendor/messages"),
  },
  {
    href: "/vendor/wholesale",
    labelKey: "studio.wholesale",
    mobileLabelKey: "studio.wholesaleShort",
    icon: Building2,
    active: (pathname: string) =>
      ["/vendor/wholesale", "/vendor/rfq", "/vendor/purchase-orders", "/vendor/invoices"].some(
        (prefix) => pathname.startsWith(prefix),
      ),
  },
  {
    href: "/delivery-live?persona=seller",
    labelKey: "studio.deliveries",
    icon: Truck,
    mobileLabelKey: "studio.deliveriesShort",
    active: () => false,
  },
  {
    href: "/vendor/earnings",
    labelKey: "studio.earnings",
    icon: Wallet,
    mobileLabelKey: "studio.earningsShort",
    active: (pathname: string) => pathname.startsWith("/vendor/earnings"),
  },
  {
    href: "/vendor/profile",
    labelKey: "studio.profile",
    mobileLabelKey: "studio.profileShort",
    icon: UserRound,
    active: (pathname: string) => pathname.startsWith("/vendor/profile"),
  },
] as const;

/**
 * Desktop section rail. It sits beside every studio page, so moving between
 * sections swaps only the content column and never the navigation.
 */
export function StudioSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("studio.nav")}
      className="space-y-0.5 rounded-xl border border-border bg-surface p-2"
    >
      {studioTabs.map((tab) => {
        const active = tab.active(pathname);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "bg-accent-soft font-medium text-foreground"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <tab.icon
              className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted-foreground")}
              aria-hidden="true"
            />
            <span className="truncate">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
