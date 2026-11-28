import type { Metadata } from "next";
import { Suspense } from "react";

import { ProviderReviewForm } from "@/components/providers/provider-review-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listProviderApplicationQueue } from "@/features/providers/queries";
import {
  PROVIDER_STATUS_KEYS,
  PROVIDER_STATUS_TONES,
  PROVIDER_TYPE_KEYS,
} from "@/features/providers/status";
import { getServerI18n } from "@/i18n/server";
import { formatDateTime } from "@/lib/utils/format-date";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Provider applications",
  robots: { index: false, follow: false },
};

export default function AdminProvidersPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AdminProvidersContent />
    </Suspense>
  );
}

async function AdminProvidersContent() {
  await requireAdmin();
  const [{ t }, pending, decided] = await Promise.all([
    getServerI18n(),
    listProviderApplicationQueue("PENDING"),
    listProviderApplicationQueue("ALL"),
  ]);
  const history = decided.filter((item) => item.status !== "PENDING").slice(0, 10);

  return (
    <PageShell className="space-y-8 py-8">
      <header>
        <p className="eyebrow text-muted-foreground">{t("providers.queueEyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em]">
          {t("providers.queueTitle")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("providers.queueBody")}
        </p>
      </header>

      <section aria-labelledby="provider-pending" className="space-y-3">
        <h2 id="provider-pending" className="font-display text-xl font-medium tracking-[-0.02em]">
          {t("providers.pendingTitle", { count: pending.length })}
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            title={t("providers.queueEmpty")}
            description={t("providers.queueEmptyBody")}
          />
        ) : (
          <ul className="space-y-3">
            {pending.map((application) => (
              <li
                key={application.id}
                className="rounded-xl border border-border bg-surface p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{application.displayName}</p>
                      <Badge tone="neutral">
                        {t(PROVIDER_TYPE_KEYS[application.providerType])}
                      </Badge>
                      <Badge tone="neutral">{application.entityStatus}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs tracking-[0.08em] text-muted-foreground">
                      {application.applicationNumber} ·{" "}
                      {t("providers.submittedOn", {
                        date: formatDateTime(new Date(application.submittedAt)),
                      })}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6">{application.summary}</p>
                    <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        {t("providers.applicant")}: {application.applicantName} ·{" "}
                        {application.applicantEmail}
                      </div>
                      <div>
                        {t("providers.contact")}: {application.contactPhone} ·{" "}
                        {application.contactEmail}
                      </div>
                      {application.district ? (
                        <div>
                          {t("providers.districtLabel")}: {application.district}
                        </div>
                      ) : null}
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {application.documents.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("providers.noDocuments")}
                        </span>
                      ) : (
                        application.documents.map((document) => (
                          <Badge key={`${document.type}:${document.reference}`} tone="neutral">
                            {t(`providers.docType.${document.type}`)}: {document.reference}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 max-w-xl">
                  <ProviderReviewForm applicationId={application.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="provider-history" className="space-y-3">
          <h2 id="provider-history" className="font-display text-xl font-medium tracking-[-0.02em]">
            {t("providers.decisionsTitle")}
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {history.map((application) => (
              <li
                key={application.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{application.displayName}</p>
                    <Badge tone="neutral">{t(PROVIDER_TYPE_KEYS[application.providerType])}</Badge>
                    <Badge tone={PROVIDER_STATUS_TONES[application.status]}>
                      {t(PROVIDER_STATUS_KEYS[application.status])}
                    </Badge>
                  </div>
                  {application.reviewNote ? (
                    <p className="mt-1 text-sm text-muted-foreground">{application.reviewNote}</p>
                  ) : null}
                </div>
                {application.reviewedAt ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(new Date(application.reviewedAt))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}
