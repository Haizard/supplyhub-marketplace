import { Suspense } from "react";

import { AgricultureConsole } from "@/components/agriculture/agriculture-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getFarmerSummary } from "@/features/agriculture/queries";
import { getSupplierProfile } from "@/features/agriculture/supplier-queries";
import { getServerI18n } from "@/i18n/server";
import { getSessionActor } from "@/server/auth/session";

export default function AgricultureConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-8 h-96 w-full max-w-[88rem]" />}>
      <AgricultureConsoleChrome>{children}</AgricultureConsoleChrome>
    </Suspense>
  );
}

/**
 * Agriculture pages are member-only, so the chrome needs the signed-in actor.
 * Signed-out visitors fall through and the page's own guard redirects them.
 */
async function AgricultureConsoleChrome({ children }: { children: React.ReactNode }) {
  const actor = await getSessionActor();
  if (!actor) return <>{children}</>;

  const { t } = await getServerI18n();
  const [farmer, supplier] = await Promise.all([
    getFarmerSummary(actor.id),
    getSupplierProfile(actor.id),
  ]);

  const place = [farmer?.district, farmer?.region].filter(Boolean).join(", ");
  const verificationStatus = farmer?.verificationStatus ?? supplier?.verificationStatus ?? null;

  return (
    <AgricultureConsole
      identity={{
        name: actor.name,
        meta: place || t("agriculture.console.network"),
        verificationStatus,
      }}
    >
      {children}
    </AgricultureConsole>
  );
}
