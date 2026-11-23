import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/storefront/page-shell";
import { listSignInEvents } from "@/features/security/sign-in-events";
import { getSecurityStatus } from "@/features/security/service";
import { SecuritySettings } from "@/features/security/components/security-settings";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Security settings",
  description: "Manage two-factor authentication and review real sign-in history.",
  robots: { index: false, follow: false },
};

export default async function AccountSecurityPage() {
  const actor = await requireActor("/account/security");
  const [status, signInEvents, { t }] = await Promise.all([
    getSecurityStatus(actor.id),
    listSignInEvents(actor.id),
    getServerI18n(),
  ]);

  if (!status) {
    redirect("/sign-in?next=/account/security");
  }

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="max-w-3xl border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">{t("securitySettings.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          {t("securitySettings.title")}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("securitySettings.subtitle")}
        </p>
      </div>

      <div className="mt-10">
        <SecuritySettings initialStatus={status} initialSignInEvents={signInEvents} />
      </div>
    </PageShell>
  );
}
