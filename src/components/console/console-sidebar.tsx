"use client";

import { ChevronDown, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

import { consoleIcons } from "./console-icons";

export interface ConsoleNavItem {
  key: string;
  label: string;
  href: string;
  /** Name in `consoleIcons`; components cannot cross the RSC boundary. */
  iconName: string;
}

export interface ConsoleNavGroup {
  key: string;
  label: string;
  items: ConsoleNavItem[];
}

/**
 * The persistent console rail shared by every role console. One current
 * section, grouped by the job each destination belongs to, collapsing into a
 * disclosure on a phone.
 */
export function ConsoleSidebar({
  groups,
  sectionsLabel,
}: {
  groups: ConsoleNavGroup[];
  sectionsLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = groups.flatMap((group) => group.items);
  const active = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.key;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="console-sections"
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
      >
        <span>{sectionsLabel}</span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <nav
        id="console-sections"
        aria-label={sectionsLabel}
        className={cn(
          "rounded-xl border border-border bg-surface p-2 shadow-[0_1px_2px_rgb(11_16_32/0.04)]",
          open ? "block" : "hidden lg:block",
        )}
      >
        <ol className="space-y-4">
          {groups.map((group) => (
            <li key={group.key}>
              <p className="px-2.5 pb-1.5 font-mono text-[0.5625rem] tracking-[0.16em] text-muted-foreground uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const current = active === item.key;
                  const Icon = consoleIcons[item.iconName] ?? LayoutDashboard;

                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={current ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] leading-tight transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          current
                            ? "bg-accent-soft font-medium text-foreground"
                            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            current ? "text-accent" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
