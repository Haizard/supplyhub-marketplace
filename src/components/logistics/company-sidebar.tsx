"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

import { companySectionGroups, resolveActiveSection } from "./company-sections";

export interface CompanySidebarLabels {
  nav: Record<string, string>;
  groups: Record<string, string>;
  /** Accessible name for the section rail and the mobile toggle. */
  sections: string;
  current: string;
}

/**
 * The persistent console rail. It replaces the old horizontal chip strip: the
 * same twenty destinations, grouped by the job they belong to, with one
 * obvious current section.
 */
export function CompanySidebar({
  companyId,
  labels,
}: {
  companyId: string;
  labels: CompanySidebarLabels;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = resolveActiveSection(pathname, companyId);
  const base = `/logistics/${companyId}`;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="company-sections"
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
      >
        <span>{labels.sections}</span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <nav
        id="company-sections"
        aria-label={labels.sections}
        className={cn(
          "rounded-xl border border-border bg-surface p-2 shadow-[0_1px_2px_rgb(11_16_32/0.04)]",
          open ? "block" : "hidden lg:block",
        )}
      >
        <ol className="space-y-4">
          {companySectionGroups.map((group) => (
            <li key={group.key}>
              <p className="px-2.5 pb-1.5 font-mono text-[0.5625rem] tracking-[0.16em] text-muted-foreground uppercase">
                {labels.groups[group.key]}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((section) => {
                  const current = active === section.key;

                  return (
                    <li key={section.key}>
                      <Link
                        href={`${base}${section.suffix}`}
                        aria-current={current ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] leading-tight transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          current
                            ? "bg-accent-soft font-medium text-foreground"
                            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                        )}
                      >
                        <section.icon
                          className={cn(
                            "size-4 shrink-0",
                            current ? "text-accent" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{labels.nav[section.key]}</span>
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
