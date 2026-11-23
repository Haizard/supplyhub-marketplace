import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { Suspense } from "react";

import { PlanForm } from "@/features/subscriptions/components/plan-form";
import { listAllPlans } from "@/features/subscriptions/queries";
import { getServerI18n } from "@/i18n/server";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Subscription plans",
  robots: { index: false, follow: false },
};

export default function AdminSubscriptionsPage() {
  return (
    <Suspense fallback={<AdminSubscriptionsSkeleton />}>
      <AdminSubscriptionsContent />
    </Suspense>
  );
}

async function AdminSubscriptionsContent() {
  const [admin, plans] = await Promise.all([requireAdmin(), listAllPlans()]);
  const { t } = await getServerI18n();

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">Administration</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          {t("subscriptions.adminTitle")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("subscriptions.adminIntro")}
        </p>
        <p className="mt-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
          {t("admin.signedInAs", { name: admin.name })}
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section aria-labelledby="subscription-plans-heading">
          <h2 id="subscription-plans-heading" className="font-display text-xl font-medium">
            {t("subscriptions.plans")}
          </h2>

          {plans.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="size-5" aria-hidden="true" />}
              title={t("subscriptions.noPlans")}
              description={t("subscriptions.noPlansBody")}
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {plans.map((plan) => (
                <li key={plan.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{plan.name}</span>
                        <Badge
                          tone={
                            plan.status === "ACTIVE"
                              ? "success"
                              : plan.status === "ARCHIVED"
                                ? "neutral"
                                : "accent"
                          }
                        >
                          {t(`subscriptions.planStatus.${plan.status}`)}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{plan.code}</p>
                      {plan.description ? (
                        <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p className="text-sm font-semibold text-foreground">
                        {Number(plan.priceMonthly).toLocaleString()} {plan.currency}
                      </p>
                      <p>
                        {plan.includedSeats} {t("subscriptions.includedSeats").toLowerCase()} ·{" "}
                        {t("subscriptions.seatLimit")} {plan.seatLimit}
                      </p>
                    </div>
                  </div>

                  {plan.features.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <details className="mt-4 border-t border-border pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[#0f766e]">
                      {t("subscriptions.editPlan")}
                    </summary>
                    <div className="mt-3">
                      <PlanForm plan={plan} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="subscription-create-heading"
          className="h-fit rounded-xl border border-border bg-surface p-6"
        >
          <h2 id="subscription-create-heading" className="font-display text-xl font-medium">
            {t("subscriptions.newPlan")}
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">{t("subscriptions.subtitle")}</p>
          <PlanForm />
        </section>
      </div>
    </PageShell>
  );
}

function AdminSubscriptionsSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading subscription plans" className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </PageShell>
  );
}
