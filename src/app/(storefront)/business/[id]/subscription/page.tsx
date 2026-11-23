import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CreditCard, ReceiptText } from "lucide-react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBusinessAccess } from "@/features/b2b/access";
import {
  CancelSubscriptionButton,
  PayInvoiceButton,
  PlanCard,
} from "@/features/subscriptions/components/subscription-controls";
import { getBusinessSubscription, listActivePlans } from "@/features/subscriptions/queries";
import { getServerI18n } from "@/i18n/server";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Business subscription",
  robots: { index: false, follow: false },
};

export default function BusinessSubscriptionPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-10 h-96 max-w-[1100px]" />}>
      <BusinessSubscriptionContent params={params} />
    </Suspense>
  );
}

async function BusinessSubscriptionContent({ params }: Props) {
  const { id } = await params;
  const access = await requireBusinessAccess(
    id,
    "subscription.manage",
    `/business/${id}/subscription`,
  ).catch(() => notFound());
  const { t } = await getServerI18n();
  const [plans, subscription] = await Promise.all([
    listActivePlans(),
    getBusinessSubscription(access.businessId),
  ]);

  return (
    <PageShell className="py-10 sm:py-14">
      <header className="border-b border-border pb-6">
        <p className="eyebrow text-muted-foreground">{t("subscriptions.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          {t("subscriptions.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subscriptions.subtitle")}</p>
      </header>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        {subscription ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-display text-xl font-medium">{subscription.plan.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("subscriptions.statusLabel", {
                    status: t(`subscriptions.status.${subscription.status}`),
                  })}
                  {" · "}
                  {subscription.seats} {t("subscriptions.seats")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("subscriptions.period", {
                    start: new Date(subscription.currentPeriodStart).toLocaleDateString(),
                    end: new Date(subscription.currentPeriodEnd).toLocaleDateString(),
                  })}
                </p>
              </div>
              {subscription.status !== "CANCELLED" ? (
                <CancelSubscriptionButton businessId={access.businessId} />
              ) : null}
            </div>

            <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold">
              <ReceiptText className="size-4" aria-hidden="true" />
              {t("subscriptions.invoices")}
            </h2>
            {subscription.invoices.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("subscriptions.noInvoices")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {subscription.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-sm font-semibold">
                        {Number(invoice.total).toLocaleString()} {invoice.currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`subscriptions.invoiceStatus.${invoice.status}`)}
                      </p>
                    </div>
                    {invoice.status !== "PAID" ? (
                      <PayInvoiceButton businessId={access.businessId} invoiceId={invoice.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="py-6 text-center">
            <CreditCard className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium">{t("subscriptions.none")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("subscriptions.noneBody")}</p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-medium">{t("subscriptions.availablePlans")}</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              businessId={access.businessId}
              current={subscription?.plan.id === plan.id}
            />
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
