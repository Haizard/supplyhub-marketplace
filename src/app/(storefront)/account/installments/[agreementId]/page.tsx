import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { StartInstallmentPaymentForm } from "@/components/installments/payment-forms";
import { getBuyerAgreementDetail } from "@/features/installments/queries";
import { listAgreementPayments } from "@/features/installments/payment-queries";
import { requireActor } from "@/server/auth/guards";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Installment agreement",
  robots: { index: false, follow: false },
};

export default async function BuyerInstallmentDetailPage({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;
  if (!uuidSchema.safeParse(agreementId).success) notFound();
  const actor = await requireActor(`/account/installments/${agreementId}`);
  const agreement = await getBuyerAgreementDetail(actor.id, agreementId);
  if (!agreement) notFound();
  const payments = await listAgreementPayments(agreementId, { buyerUserId: actor.id });
  const nextAmount =
    agreement.schedule.find((entry) => entry.status === "PENDING")?.amount ??
    agreement.installmentAmount;

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{agreement.agreementNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seller: {agreement.counterpartyName}</p>
        </div>
        <Badge tone={agreement.status === "ACTIVE" ? "success" : "neutral"}>
          {agreement.status}
        </Badge>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Contract summary</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <dt>Cash price</dt>
          <dd>
            {agreement.cashPrice} {agreement.currency}
          </dd>
          <dt>Deposit ({agreement.depositMode})</dt>
          <dd>
            {agreement.depositAmount} {agreement.currency}
          </dd>
          <dt>Total payable</dt>
          <dd>
            {agreement.totalPayable} {agreement.currency}
          </dd>
          <dt>Outstanding balance</dt>
          <dd>
            {agreement.outstandingBalance} {agreement.currency}
          </dd>
          <dt>Schedule</dt>
          <dd>
            {agreement.installmentCount} × {agreement.installmentAmount} · {agreement.frequency}
          </dd>
          <dt>Possession</dt>
          <dd>{agreement.possessionModel}</dd>
          <dt>Grace period</dt>
          <dd>{agreement.gracePeriodDays} days</dd>
          <dt>Source</dt>
          <dd>{agreement.source}</dd>
        </dl>
        {agreement.latePaymentPolicy ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Late-payment policy: {agreement.latePaymentPolicy}
          </p>
        ) : null}
        {agreement.cancellationReason ? (
          <p className="mt-3 text-xs text-danger">Cancelled: {agreement.cancellationReason}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Items</h2>
        <ul className="mt-3 space-y-2">
          {agreement.items.map((item) => (
            <li key={`${item.productName}-${item.sku ?? ""}`}>
              {item.productName} · {item.quantity} × {item.unitPrice} = {item.lineTotal}{" "}
              {agreement.currency}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Payment schedule</h2>
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2">#</th>
              <th>Due date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {agreement.schedule.map((entry) => (
              <tr key={entry.sequence} className="border-b border-border/50">
                <td className="py-2">{entry.sequence}</td>
                <td>{new Date(entry.dueDate).toLocaleDateString()}</td>
                <td>
                  {entry.amount} {entry.currency}
                </td>
                <td>{entry.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {["PENDING_DEPOSIT", "ACTIVE", "OVERDUE"].includes(agreement.status) ? (
        <section className="rounded-xl border border-border bg-surface p-6 text-sm">
          <h2 className="font-display text-lg font-medium">Make a payment</h2>
          <div className="mt-4">
            <StartInstallmentPaymentForm agreementId={agreement.id} suggestedAmount={nextAmount} />
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Payment history</h2>
        <ul className="mt-3 space-y-2">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-md border border-border/50 p-3 text-xs">
              <p>
                {payment.reference} · {payment.amount} {payment.currency} · {payment.method} ·{" "}
                <span className="font-medium">{payment.status}</span>
              </p>
              <p className="text-muted-foreground">
                {payment.verifiedAt
                  ? `Verified ${new Date(payment.verifiedAt).toLocaleString()}`
                  : "Awaiting provider verification"}
                {payment.allocations.length > 0
                  ? ` · allocated to #${payment.allocations.map((a) => a.sequence).join(", #")}`
                  : ""}
              </p>
              {payment.checkoutUrl && payment.status === "PENDING" ? (
                <a href={payment.checkoutUrl} className="text-accent underline">
                  Continue at provider
                </a>
              ) : null}
              {payment.receipt ? (
                <a
                  href={`/api/installments/receipts/${payment.receipt.id}`}
                  className="ml-3 text-accent underline"
                >
                  Download receipt ({payment.receipt.receiptNumber})
                </a>
              ) : null}
            </li>
          ))}
          {payments.length === 0 ? (
            <li className="text-muted-foreground">No payments recorded.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Agreement history</h2>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {agreement.events.map((event, index) => (
            <li key={`${event.type}-${index}`}>
              {event.type}
              {event.fromStatus ? ` (${event.fromStatus} → ${event.toStatus})` : ""} ·{" "}
              {new Date(event.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-xl border border-border bg-surface p-6 text-xs">
        <summary className="cursor-pointer font-medium">Frozen contract snapshot</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(agreement.termsSnapshot, null, 2)}
        </pre>
      </details>
    </PageShell>
  );
}
