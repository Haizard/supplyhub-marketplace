import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";

import { ConsoleSidebar, type ConsoleNavGroup } from "./console-sidebar";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export interface ConsoleShellProps {
  /** Who or what this console belongs to. */
  name: string;
  /** Secondary identity line: code, city, plan — whatever that console uses. */
  meta: string;
  badge?: { label: string; tone: ComponentProps<typeof Badge>["tone"] };
  back: { href: string; label: string };
  actions?: ReactNode;
  groups: ConsoleNavGroup[];
  sectionsLabel: string;
  /** Small print under the rail, e.g. the company or farmer id. */
  footnote?: string;
  children: ReactNode;
}

/**
 * One chrome for every role console: identity bar on top, grouped rail on the
 * left, one content column. Pages only render their header and sections, so
 * navigation and rhythm never shift between screens.
 */
export function ConsoleShell({
  name,
  meta,
  badge,
  back,
  actions,
  groups,
  sectionsLabel,
  footnote,
  children,
}: ConsoleShellProps) {
  return (
    <div>
      <div className="border-b border-border bg-surface">
        <PageShell className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            {back.label}
          </Link>

          <span aria-hidden="true" className="hidden h-8 w-px bg-border sm:block" />

          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-display text-xs font-semibold text-primary-foreground"
            >
              {monogram(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm leading-tight font-medium">{name}</p>
              <p className="mt-0.5 truncate font-mono text-[0.5625rem] tracking-[0.14em] text-muted-foreground uppercase">
                {meta}
              </p>
            </div>
            {badge ? (
              <Badge tone={badge.tone} className="hidden sm:inline-flex">
                {badge.label}
              </Badge>
            ) : null}
          </div>

          {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
        </PageShell>
      </div>

      <PageShell className="grid gap-6 py-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 self-start lg:sticky lg:top-32">
          <ConsoleSidebar groups={groups} sectionsLabel={sectionsLabel} />
          {footnote ? (
            <p className="mt-3 hidden px-1 font-mono text-[0.5625rem] leading-5 tracking-[0.12em] text-muted-foreground uppercase lg:block">
              {footnote}
            </p>
          ) : null}
        </aside>

        <div className="min-w-0">{children}</div>
      </PageShell>
    </div>
  );
}
