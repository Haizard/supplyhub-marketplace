"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { workspaceIcon } from "@/components/workspace/icons";
import type { WorkspaceNavItem } from "@/features/workspace/experience";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

export function WorkspaceNav({
  items,
  layout,
}: {
  items: WorkspaceNavItem[];
  layout: "bottom" | "inline";
}) {
  const pathname = usePathname();
  const t = useT();

  const isActive = (href: string) =>
    href === "/workspace"
      ? pathname === "/workspace" || pathname === "/workspace/sell"
      : pathname.startsWith(href);

  if (layout === "inline") {
    return (
      <nav aria-label={t("workspace.nav.label")} className="hidden items-center gap-1 md:flex">
        {items.map((item) => {
          const Icon = workspaceIcon(item.icon);
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("workspace.nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-between px-1.5">
        {items.map((item) => {
          const Icon = workspaceIcon(item.icon);
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <span
                className={cn(
                  "grid h-7 w-11 place-items-center rounded-full transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground group-hover:bg-surface-muted group-hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-[0.625rem] leading-none",
                  active ? "font-semibold text-accent" : "font-medium text-muted-foreground",
                )}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
