import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Sprout, Store, Truck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ProviderApplicationForm } from "@/components/providers/provider-application-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listApplicantProviderOptions } from "@/features/providers/queries";
import {
  PROVIDER_STATUS_KEYS,
  PROVIDER_STATUS_TONES,
  PROVIDER_TYPE_KEYS,
} from "@/features/providers/status";
import { getServerI18n } from "@/i18n/server";
import { formatDateTime } from "@/lib/utils/format-date";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Provider verification",
  description: "Apply to become a verified farmer, delivery company or service studio.",
  robots: { index: false, follow: false },
};

export default function ProviderVerificationPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <ProviderVerificationContent />
    </Suspense>
  );
}

async function ProviderVerificationContent() {
  const [actor, { t }] = await Promise.all([
    requireActor("/provider/verification"),
    getServerI18n(),
  ]);
  const options = await listApplicantProviderOptions(actor);

  const selectOptions = options.map((option) => ({
    value: `${option.providerType}:${option.entityId}`,
    label: `${t(PROVIDER_TYPE_KEYS[option.providerType])} · ${option.name}`,
    disabled: option.application?.status === "PENDING" || option.application?.status === "APPROVED",
  }));
  const first = options[0];
  const defaults = {
    displayName: first?.name ?? "",
    contactPhone: first?.prefill.phone ?? "",
    contactEmail: first?.prefill.email ?? actor.email,
    district: first?.prefill.district ?? "",
  };

  return (
    <PageShell className="max-w-3xl space-y-8 py-10 sm:py-14">
      <header>
        <p className="eyebrow text-muted-foreground">{t("providers.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] sm:text-5xl">
          {t("providers.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("providers.body")}
        </p>
      </header>

      {options.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="size-5" aria-hidden="true" />}
          title={t("providers.noEntities")}
          description={t("providers.noEntitiesBody")}
        >
          <Button asChild variant="secondary">
            <Link href="/agriculture/farmer">
              <Sprout className="size-4" aria-hidden="true" />
              {t("providers.goFarm")}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/logistics/register">
              <Truck className="size-4" aria-hidden="true" />
              {t("providers.goLogistics")}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/vendor">
              <Store className="size-4" aria-hidden="true" />
              {t("providers.goStudio")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="provider-identities" className="space-y-3">
            <h2
              id="provider-identities"
              className="font-display text-xl font-medium tracking-[-0.02em]"
            >
              {t("providers.yourTitle")}
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {options.map((option) => (
                <li
                  key={`${option.providerType}:${option.entityId}`}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{option.name}</p>
                      <Badge tone="neutral">{t(PROVIDER_TYPE_KEYS[option.providerType])}</Badge>
                      {option.application ? (
                        <Badge tone={PROVIDER_STATUS_TONES[option.application.status]}>
                          {t(PROVIDER_STATUS_KEYS[option.application.status])}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">{t("providers.status.NOT_APPLIED")}</Badge>
                      )}
                    </div>
                    {option.application ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("providers.application", {
                          number: option.application.applicationNumber,
                        })}{" "}
                        ·{" "}
                        {t("providers.submittedOn", {
                          date: formatDateTime(new Date(option.application.submittedAt)),
                        })}
                      </p>
                    ) : null}
                    {option.application?.reviewNote ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("providers.reviewNoteLabel", { note: option.application.reviewNote })}
                      </p>
                    ) : null}
                  </div>
                  {!option.application ||
                  option.application.status === "REJECTED" ||
                  option.application.status === "WITHDRAWN" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                      {t("providers.readyToApply")}
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="provider-apply"
            className="rounded-xl border border-border bg-surface p-6 sm:p-8"
          >
            <h2
              id="provider-apply"
              className="font-display text-2xl font-medium tracking-[-0.02em]"
            >
              {t("providers.applyTitle")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {t("providers.applyBody")}
            </p>
            <div className="mt-6">
              <ProviderApplicationForm options={selectOptions} defaults={defaults} />
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
