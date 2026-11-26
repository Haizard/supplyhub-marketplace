import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  DecideAmendmentForm,
  SignInstallmentDocumentForm,
} from "@/components/installments/contract-forms";
import { AcceptFinancingForm } from "@/components/installments/financing-forms";
import {
  listContractDocuments,
  listFinancingApplications,
  listInstallmentAmendments,
} from "@/features/installments/contract-queries";
import { isFeatureEnabled } from "@/features/flags/service";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { StartInstallmentPaymentForm } from "@/components/installments/payment-forms";
import { OpenInstallmentDisputeForm } from "@/components/installments/report-forms";
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
  const [payments, documents, amendments, applications, financingEnabled] = await Promise.all([
    listAgreementPayments(agreementId, { buyerUserId: actor.id }),
    listContractDocuments(agreementId),
    listInstallmentAmendments(agreementId),
    listFinancingApplications(agreementId),
    isFeatureEnabled("phase10.installmentFinancing"),
  ]);
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
        <h2 className="font-display text-lg font-medium">Contract versions</h2>
        <ul className="mt-3 space-y-3">
          {documents.map((document) => (
            <li key={document.id} className="rounded-md border border-border/50 p-3 text-xs">
              <p>
                v{document.version} · {document.documentNumber} · {document.status} · sha256{" "}
                {document.contentHash.slice(0, 12)}
              </p>
              <p className="text-muted-foreground">
                Signatures: {document.signatures.map((s) => s.role).join(", ") || "none"}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-accent">Read contract text</summary>
                <pre className="mt-2 whitespace-pre-wrap">{document.body}</pre>
              </details>
              {!document.signatures.some((s) => s.role === "BUYER") &&
              document.status !== "VOID" ? (
                <div className="mt-2">
                  <SignInstallmentDocumentForm documentId={document.id} />
                </div>
              ) : null}
            </li>
          ))}
          {documents.length === 0 ? (
            <li className="text-muted-foreground">No contract versions yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Amendments</h2>
        <ul className="mt-3 space-y-2 text-xs">
          {amendments.map((amendment) => (
            <li key={amendment.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                v{amendment.version} · {amendment.status} · {amendment.reason}
              </span>
              {amendment.status === "PROPOSED" ? (
                <DecideAmendmentForm amendmentId={amendment.id} />
              ) : null}
            </li>
          ))}
          {amendments.length === 0 ? (
            <li className="text-muted-foreground">No amendments proposed.</li>
          ) : null}
        </ul>
      </section>

      {financingEnabled && applications.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-6 text-sm">
          <h2 className="font-display text-lg font-medium">Financing offers</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {applications.map((application) => (
              <li
                key={application.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {application.applicationNumber} · {application.partnerCode} ·{" "}
                  {application.requestedAmount} {application.currency} · {application.status}
                  {application.offeredAmount ? ` · offered ${application.offeredAmount}` : ""}
                </span>
                {application.status === "APPROVED" ? (
                  <AcceptFinancingForm applicationId={application.id} />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Open a dispute</h2>
        <div className="mt-4 max-w-lg">
          <OpenInstallmentDisputeForm agreementId={agreement.id} compact />
        </div>
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
