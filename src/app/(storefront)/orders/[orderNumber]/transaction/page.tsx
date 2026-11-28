import type { Metadata } from "next";
import { ArrowLeft, PackageCheck, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { TransactionActions } from "@/components/marketplaces/transaction-actions";
import { TransactionForm } from "@/components/marketplaces/transaction-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { decimalToCents, formatMoney } from "@/features/catalog/money";
import { getOrderForViewer } from "@/features/checkout/queries";
import { listPublicLogisticsCompanies } from "@/features/logistics-companies/queries";
import { getTransactionForOrder } from "@/features/marketplaces/transactions/queries";
import {
  TRANSACTION_STATUS_TONES,
  timelineLabelKey,
} from "@/features/marketplaces/transactions/status";
import { listActiveServiceListings } from "@/features/services/queries";
import { getServerI18n } from "@/i18n/server";
import { formatDateTime } from "@/lib/utils/format-date";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Delivery and services",
  description: "Connect an order to a delivery job and an optional service booking.",
  robots: { index: false, follow: false },
};

/** Configurable demo default for the map coordinates in the booking form. */
const DEFAULT_LATITUDE = "-6.7924";
const DEFAULT_LONGITUDE = "39.2083";

export default function TransactionPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <TransactionContent params={params} />
    </Suspense>
  );
}

async function TransactionContent({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [actor, { t }] = await Promise.all([
    requireActor(`/orders/${orderNumber}/transaction`),
    getServerI18n(),
  ]);

  const order = await getOrderForViewer(actor, orderNumber);
  if (!order) notFound();

  const transaction = await getTransactionForOrder(actor, orderNumber);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <Link
        href={`/orders/${orderNumber}`}
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("transactions.backToOrder")}
      </Link>

      <div className="mt-6 border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">{t("transactions.eyebrow")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl leading-none font-medium tracking-[-0.04em] sm:text-5xl">
            {t("transactions.title")}
          </h1>
          {transaction ? (
            <Badge tone={TRANSACTION_STATUS_TONES[transaction.status]}>
              {t(`transactions.status.${transaction.status}`)}
            </Badge>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("transactions.forOrder", { order: orderNumber })} ·{" "}
          {order.vendorOrders.map((vendorOrder) => vendorOrder.vendorName).join(", ")}
        </p>
        {transaction ? (
          <p className="mt-1 font-mono text-xs tracking-[0.1em] text-muted-foreground">
            {transaction.transactionNumber}
          </p>
        ) : (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("transactions.body")}
          </p>
        )}
      </div>

      {transaction ? (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-surface">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4 sm:px-6">
                <Truck className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">
                  {t("transactions.logisticsTitle")}
                </h2>
              </div>
              {transaction.logistics ? (
                <dl className="space-y-3 px-5 py-5 text-sm sm:px-6">
                  <Row
                    label={t("transactions.logisticsCompany")}
                    value={transaction.logistics.companyName ?? "—"}
                  />
                  <Row
                    label={t("transactions.logisticsRequest")}
                    value={transaction.logistics.requestNumber}
                  />
                  <Row
                    label={t("transactions.logisticsStatus")}
                    value={t(
                      `transactions.logistics.${transaction.logistics.jobStatus ?? transaction.logistics.status}`,
                    )}
                  />
                  <Row
                    label={t("transactions.logisticsFee")}
                    value={formatMoney(
                      decimalToCents(transaction.logistics.fee),
                      transaction.logistics.currency,
                    )}
                  />
                  <Row
                    label={t("transactions.logisticsRoute", {
                      from: transaction.logistics.pickupAddress,
                      to: transaction.logistics.dropoffAddress,
                    })}
                    value={t("transactions.logisticsDistance", {
                      km: transaction.logistics.distanceKm,
                    })}
                  />
                </dl>
              ) : (
                <p className="px-5 py-5 text-sm text-muted-foreground sm:px-6">
                  {t("transactions.timelineEmpty")}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4 sm:px-6">
                <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">
                  {t("transactions.serviceTitle")}
                </h2>
              </div>
              {transaction.service ? (
                <dl className="space-y-3 px-5 py-5 text-sm sm:px-6">
                  <Row
                    label={t("transactions.serviceProvider")}
                    value={transaction.service.vendorName}
                  />
                  <Row label={t("transactions.serviceTitle")} value={transaction.service.title} />
                  <Row
                    label={t("transactions.serviceStatus")}
                    value={t(`transactions.booking.${transaction.service.status}`)}
                  />
                  <Row
                    label={t("transactions.serviceWhen")}
                    value={formatDateTime(new Date(transaction.service.scheduledAt))}
                  />
                  <Row
                    label={t("transactions.servicePrice")}
                    value={formatMoney(
                      decimalToCents(transaction.service.unitPrice),
                      transaction.service.currency,
                    )}
                  />
                  <Row
                    label={t("transactions.logisticsRequest")}
                    value={transaction.service.bookingNumber}
                  />
                </dl>
              ) : (
                <p className="px-5 py-5 text-sm text-muted-foreground sm:px-6">
                  {t("transactions.noService")}
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-medium tracking-[-0.02em]">
                {t("transactions.timeline")}
              </h2>
              {transaction.timeline.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("transactions.timelineEmpty")}
                </p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {transaction.timeline.map((entry, index) => (
                    <li key={entry.id} className="relative pl-5">
                      {index < transaction.timeline.length - 1 ? (
                        <span
                          className="absolute top-4 bottom-[-1rem] left-[3px] w-px bg-border"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span
                        className={
                          index === transaction.timeline.length - 1
                            ? "absolute top-1.5 left-0 size-2 rounded-full bg-accent"
                            : "absolute top-1.5 left-0 size-2 rounded-full bg-border-strong"
                        }
                        aria-hidden="true"
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-medium">
                          {t(timelineLabelKey(entry.source, entry.kind))}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(new Date(entry.at))}
                        </p>
                      </div>
                      {entry.note ? (
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          {entry.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="flex items-center gap-2">
                <PackageCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">
                  {t(`transactions.source.${transaction.source}`)}
                </h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("transactions.forOrder", { order: orderNumber })}
              </p>
              <Button asChild variant="secondary" className="mt-4 w-full">
                <Link href={`/orders/${orderNumber}`}>{t("transactions.backToOrder")}</Link>
              </Button>
            </section>

            <TransactionActions
              transactionId={transaction.id}
              orderNumber={orderNumber}
              canCancel={transaction.canCancel}
              canComplete={transaction.canComplete}
            />
          </aside>
        </div>
      ) : (
        <BookingSection
          orderNumber={orderNumber}
          pickupName={order.vendorOrders[0]?.vendorName ?? ""}
          dropoffName={order.address.recipientName}
          dropoffAddress={[order.address.addressLine1, order.address.city]
            .filter(Boolean)
            .join(", ")}
        />
      )}
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

async function BookingSection({
  orderNumber,
  pickupName,
  dropoffName,
  dropoffAddress,
}: {
  orderNumber: string;
  pickupName: string;
  dropoffName: string;
  dropoffAddress: string;
}) {
  const { t } = await getServerI18n();
  const [companies, services] = await Promise.all([
    listPublicLogisticsCompanies(50),
    listActiveServiceListings(),
  ]);

  return (
    <section className="mt-8 max-w-3xl rounded-xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">
        {t("transactions.bookTitle")}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {t("transactions.bookBody")}
      </p>
      <div className="mt-6">
        <TransactionForm
          orderNumber={orderNumber}
          defaults={{
            pickupName,
            pickupAddress: "",
            pickupLatitude: DEFAULT_LATITUDE,
            pickupLongitude: DEFAULT_LONGITUDE,
            dropoffName,
            dropoffAddress,
            dropoffLatitude: DEFAULT_LATITUDE,
            dropoffLongitude: DEFAULT_LONGITUDE,
          }}
          companies={companies.map((company) => ({
            id: company.id,
            name: company.name,
            city: company.city,
          }))}
          services={services.map((service) => ({
            id: service.id,
            title: service.title,
            vendorName: service.vendorName,
            priceLabel: formatMoney(decimalToCents(service.unitPrice), service.currency),
          }))}
        />
      </div>
    </section>
  );
}
