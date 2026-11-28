import { Building2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/storefront/page-shell";
import type { LogisticsCompanyView } from "@/features/logistics-companies/queries";
import { COMPANY_STATUS_LABELS } from "@/features/logistics-companies/status";
import { getServerI18n } from "@/i18n/server";

import { CompanySidebar } from "./company-sidebar";
import { companySectionGroups } from "./company-sections";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * One chrome for the whole member console: company identity on top, the
 * grouped section rail on the left, and a single content column. Pages only
 * render their header and their sections, so every screen has the same
 * navigation in the same place.
 */
export async function CompanyConsole({
  company,
  children,
}: {
  company: LogisticsCompanyView;
  children: ReactNode;
}) {
  const { t } = await getServerI18n();

  const labels = {
    sections: t("logistics.console.sections"),
    current: t("logistics.console.current"),
    nav: Object.fromEntries(
      companySectionGroups
        .flatMap((group) => group.items)
        .map((section) => [section.key, t(`logistics.console.nav.${section.key}`)]),
    ),
    groups: Object.fromEntries(
      companySectionGroups.map((group) => [group.key, t(`logistics.console.groups.${group.key}`)]),
    ),
  };

  return (
    <div>
      <div className="border-b border-border bg-surface">
        <PageShell className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
          <Link
            href="/logistics"
            className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            {t("logistics.console.network")}
          </Link>

          <span aria-hidden="true" className="hidden h-8 w-px bg-border sm:block" />

          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-display text-xs font-semibold text-primary-foreground"
            >
              {monogram(company.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm leading-tight font-medium">
                {company.name}
              </p>
              <p className="mt-0.5 truncate font-mono text-[0.5625rem] tracking-[0.14em] text-muted-foreground uppercase">
                {company.companyCode} · {company.city ?? "—"} · {t("logistics.console.plan")}{" "}
                {company.plan}
              </p>
            </div>
            <Badge
              tone={company.status === "APPROVED" ? "success" : "neutral"}
              className="hidden sm:inline-flex"
            >
              {COMPANY_STATUS_LABELS[company.status]}
            </Badge>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/logistics/${company.id}/edit`}>
                <Building2 className="size-4" aria-hidden="true" />
                {t("logistics.console.profile")}
              </Link>
            </Button>
          </div>
        </PageShell>
      </div>

      <PageShell className="grid gap-6 py-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 self-start lg:sticky lg:top-32">
          <CompanySidebar companyId={company.id} labels={labels} />
          <p className="mt-3 hidden px-1 font-mono text-[0.5625rem] leading-5 tracking-[0.12em] text-muted-foreground uppercase lg:block">
            {t("logistics.console.companyId")} {company.companyCode}
          </p>
        </aside>

        <div className="min-w-0">{children}</div>
      </PageShell>
    </div>
  );
}
