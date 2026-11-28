import { Building2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ConsoleShell } from "@/components/console/console-shell";
import type { ConsoleNavGroup } from "@/components/console/console-sidebar";
import { Button } from "@/components/ui/button";
import type { LogisticsCompanyView } from "@/features/logistics-companies/queries";
import { COMPANY_STATUS_LABELS } from "@/features/logistics-companies/status";
import { getServerI18n } from "@/i18n/server";

import { companySectionGroups } from "./company-sections";

/**
 * The logistics company console around every company page, so the rail and the
 * identity bar never move as members switch sections.
 */
export async function CompanyConsole({
  company,
  children,
}: {
  company: LogisticsCompanyView;
  children: ReactNode;
}) {
  const { t } = await getServerI18n();

  const groups: ConsoleNavGroup[] = companySectionGroups.map((group) => ({
    key: group.key,
    label: t(`logistics.console.groups.${group.key}`),
    items: group.items.map((section) => ({
      key: section.key,
      label: t(`logistics.console.nav.${section.key}`),
      href: `/logistics/${company.id}${section.suffix}`,
      iconName: section.iconName,
    })),
  }));

  return (
    <ConsoleShell
      name={company.name}
      meta={`${company.companyCode} · ${company.city ?? "—"} · ${t("logistics.console.plan")} ${company.plan}`}
      badge={{
        label: COMPANY_STATUS_LABELS[company.status],
        tone: company.status === "APPROVED" ? "success" : "neutral",
      }}
      back={{ href: "/logistics", label: t("logistics.console.network") }}
      actions={
        <Button asChild variant="secondary" size="sm">
          <Link href={`/logistics/${company.id}/edit`}>
            <Building2 className="size-4" aria-hidden="true" />
            {t("logistics.console.profile")}
          </Link>
        </Button>
      }
      groups={groups}
      sectionsLabel={t("logistics.console.sections")}
      footnote={`${t("logistics.console.companyId")} ${company.companyCode}`}
    >
      {children}
    </ConsoleShell>
  );
}
