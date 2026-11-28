import { Store } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ConsoleShell } from "@/components/console/console-shell";
import type { ConsoleNavGroup } from "@/components/console/console-sidebar";
import { Button } from "@/components/ui/button";
import { getServerI18n } from "@/i18n/server";

import { agricultureSectionGroups } from "./agriculture-sections";

export interface AgricultureIdentity {
  name: string;
  meta: string;
  verificationStatus?: string | null;
}

/** The farm console around every agriculture member page. */
export async function AgricultureConsole({
  identity,
  children,
}: {
  identity: AgricultureIdentity;
  children: ReactNode;
}) {
  const { t } = await getServerI18n();

  const groups: ConsoleNavGroup[] = agricultureSectionGroups.map((group) => ({
    key: group.key,
    label: t(`agriculture.console.groups.${group.key}`),
    items: group.items.map((section) => ({
      key: section.key,
      label: t(`agriculture.console.nav.${section.key}`),
      href: section.href,
      iconName: section.iconName,
    })),
  }));

  return (
    <ConsoleShell
      name={identity.name}
      meta={identity.meta}
      badge={
        identity.verificationStatus
          ? {
              label: identity.verificationStatus,
              tone: identity.verificationStatus === "VERIFIED" ? "success" : "neutral",
            }
          : undefined
      }
      back={{ href: "/agriculture/marketplace", label: t("agriculture.console.network") }}
      actions={
        <Button asChild variant="secondary" size="sm">
          <Link href="/agriculture/marketplace">
            <Store className="size-4" aria-hidden="true" />
            {t("agriculture.console.marketplace")}
          </Link>
        </Button>
      }
      groups={groups}
      sectionsLabel={t("agriculture.console.sections")}
    >
      {children}
    </ConsoleShell>
  );
}
