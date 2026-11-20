import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StudioPageHead } from "@/components/vendor/studio-page-head";
import { getPosSaleReceipt } from "@/features/pos/receipt-queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Receipt",
  description: "Printable counter sale receipt.",
  robots: { index: false, follow: false },
};

const POS_PATH = "/vendor/pos";

export default function PosReceiptPage({ params }: { params: Promise<{ saleNumber: string }> }) {
  return (
    <Suspense fallback={<ReceiptSkeleton />}>
      <ReceiptContent params={params} />
    </Suspense>
  );
}

async function ReceiptContent({ params }: { params: Promise<{ saleNumber: string }> }) {
  const [access, { saleNumber }, { t, formatCurrency, formatDate, formatTime }] = await Promise.all(
    [requireStudioAccess("pos.sale.create", POS_PATH), params, getServerI18n()],
  );

  const receipt = await getPosSaleReceipt(access.vendorId, saleNumber);

  if (!receipt) notFound();

  const money = (cents: number) => formatCurrency(cents, receipt.currency);
  const methods: Record<string, string> = {
    CASH: t("pos.cash"),
    MOBILE_MONEY: t("pos.mobileMoney"),
    CARD: t("pos.card"),
    OTHER: t("pos.other"),
  };
  const address = [receipt.business.street, receipt.business.city].filter(Boolean).join(", ");

  return (
    <>
      <div className="print:hidden">
        <StudioPageHead
          title={t("pos.receiptTitle")}
          description={t("pos.receiptDescription")}
          action={
            <>
              <ReceiptPrintButton label={t("pos.receiptPrint")} />
              <Button asChild variant="secondary" size="sm">
                <Link href={POS_PATH}>{t("pos.receiptBack")}</Link>
              </Button>
            </>
          }
        />
      </div>

      <article className="receipt-sheet mx-auto w-full max-w-sm rounded-[26px] border border-border bg-surface px-6 py-7 font-mono text-[12px] leading-5 text-foreground shadow-[0_20px_50px_-30px_rgba(0,0,0,0.5)]">
        <header className="text-center">
          <p className="font-display text-lg font-semibold tracking-[-0.02em]">
            {receipt.business.name}
          </p>
          {address ? <p className="mt-0.5 text-muted-foreground">{address}</p> : null}
          {receipt.business.phone ? (
            <p className="text-muted-foreground">{receipt.business.phone}</p>
          ) : null}
        </header>

        <div className="my-4 border-t border-dashed border-border" />

        <dl className="space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("pos.receiptNumber")}</dt>
            <dd className="text-right font-semibold">{receipt.saleNumber}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("pos.receiptSold")}</dt>
            <dd className="text-right">
              {formatDate(receipt.soldAt, { day: "numeric", month: "short", year: "numeric" })}
              {", "}
              {formatTime(receipt.soldAt, { hour: "2-digit", minute: "2-digit" })}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("pos.receiptCashier")}</dt>
            <dd className="text-right">{receipt.cashierName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("pos.receiptRegister")}</dt>
            <dd className="text-right">{receipt.registerName}</dd>
          </div>
        </dl>

        <div className="my-4 border-t border-dashed border-border" />

        <table className="w-full">
          <thead className="sr-only">
            <tr>
              <th scope="col">{t("pos.receiptItem")}</th>
              <th scope="col">{t("pos.receiptQty")}</th>
              <th scope="col">{t("pos.receiptAmount")}</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="py-1.5 pr-3">
                  <span className="block">{item.name}</span>
                  {item.variantName ? (
                    <span className="block text-[11px]">{item.variantName}</span>
                  ) : null}
                  <span className="block text-[11px] text-muted-foreground">
                    {item.sku} · {money(item.unitPriceCents)}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap tabular-nums">
                  ×{item.quantity}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                  {money(item.lineTotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-4 border-t border-dashed border-border" />

        <dl className="space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("pos.subtotal")}</dt>
            <dd className="text-right tabular-nums">{money(receipt.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-[14px] font-semibold">
            <dt>{t("pos.receiptTotal")}</dt>
            <dd className="text-right tabular-nums">{money(receipt.totalCents)}</dd>
          </div>
          {receipt.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {methods[payment.method] ?? payment.method}
                {payment.reference ? (
                  <span className="block text-[11px]">{payment.reference}</span>
                ) : null}
              </dt>
              <dd className="text-right tabular-nums">{money(payment.amountCents)}</dd>
            </div>
          ))}
        </dl>

        <div className="my-4 border-t border-dashed border-border" />

        <p className="text-center text-[11px] text-muted-foreground">{t("pos.receiptThanks")}</p>
      </article>
    </>
  );
}

function ReceiptSkeleton() {
  return (
    <div role="status" aria-label="Loading the receipt" className="mx-auto w-full max-w-sm">
      <Skeleton className="mb-5 h-8 w-40" />
      <Skeleton className="h-[26rem] w-full rounded-[26px]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
