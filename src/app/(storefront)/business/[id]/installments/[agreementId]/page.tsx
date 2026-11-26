import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  CreateInstallmentDocumentForm,
  FinancingApplicationForm,
  ProposeAmendmentForm,
  SignInstallmentDocumentForm,
  VoidInstallmentDocumentForm,
} from "@/components/installments/contract-forms";
import { RecordCashPaymentForm, RefundPaymentForm } from "@/components/installments/payment-forms";
import { OpenInstallmentDisputeForm } from "@/components/installments/report-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { authorizeInstallmentSeller } from "@/features/installments/access";
import {
  listContractDocuments,
  listFinancingApplications,
  listInstallmentAmendments,
} from "@/features/installments/contract-queries";
import { isFeatureEnabled } from "@/features/flags/service";
import { listAgreementPayments } from "@/features/installments/payment-queries";
import { listSellerInstallments } from "@/features/installments/queries";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Installment agreement payments",
  robots: { index: false, follow: false },
};

export default async function SellerInstallmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; agreementId: string }>;
}) {
  const { id, agreementId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(agreementId).success) notFound();
  const access = await authorizeInstallmentSeller(
    id,
    `/business/${id}/installments/${agreementId}`,
  );
  if ("error" in access) notFound();

  const [agreements, payments, documents, amendments, applications, financingEnabled] =
    await Promise.all([
      listSellerInstallments(id),
      listAgreementPayments(agreementId, { businessId: id }),
      listContractDocuments(agreementId),
      listInstallmentAmendments(agreementId),
      listFinancingApplications(agreementId),
      isFeatureEnabled("phase10.installmentFinancing"),
    ]);
  const agreement = agreements.find((row) => row.id === agreementId);
  if (!agreement) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{agreement.agreementNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Buyer: {agreement.counterpartyName}</p>
        </div>
        <Badge tone={agreement.status === "ACTIVE" ? "success" : "neutral"}>
          {agreement.status}
        </Badge>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Balance</h2>
        <p className="mt-2">
          Cash {agreement.cashPrice} · deposit {agreement.depositAmount} · outstanding{" "}
          {agreement.outstandingBalance} {agreement.currency}
        </p>
        {["PENDING_DEPOSIT", "ACTIVE", "OVERDUE"].includes(agreement.status) ? (
          <div className="mt-4">
            <RecordCashPaymentForm businessId={id} agreementId={agreementId} />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Payments</h2>
        <ul className="mt-3 space-y-3">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="space-y-2 rounded-md border border-border/50 p-3 text-xs"
            >
              <p>
                {payment.reference} · {payment.amount} {payment.currency} · {payment.method} ·{" "}
                <span className="font-medium">{payment.status}</span>
              </p>
              <p className="text-muted-foreground">
                {payment.verifiedAt
                  ? `Verified ${new Date(payment.verifiedAt).toLocaleString()}`
                  : "Awaiting provider verification"}
                {payment.allocations.length > 0
                  ? ` · #${payment.allocations.map((a) => `${a.sequence}: ${a.amount}`).join(", #")}`
                  : ""}
              </p>
              {payment.status === "VERIFIED" ? (
                <RefundPaymentForm businessId={id} paymentId={payment.id} />
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
        <div className="mt-3">
          <CreateInstallmentDocumentForm businessId={id} agreementId={agreementId} />
        </div>
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
              <div className="mt-2 flex flex-wrap gap-2">
                {!document.signatures.some((s) => s.role === "SELLER") &&
                document.status !== "VOID" ? (
                  <SignInstallmentDocumentForm businessId={id} documentId={document.id} />
                ) : null}
                {document.status !== "VOID" ? (
                  <VoidInstallmentDocumentForm businessId={id} documentId={document.id} />
                ) : null}
              </div>
            </li>
          ))}
          {documents.length === 0 ? (
            <li className="text-muted-foreground">No contract versions yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Amendments</h2>
        <div className="mt-3 max-w-lg">
          <ProposeAmendmentForm businessId={id} agreementId={agreementId} />
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {amendments.map((amendment) => (
            <li key={amendment.id}>
              v{amendment.version} · {amendment.status} · {amendment.reason}
            </li>
          ))}
          {amendments.length === 0 ? <li>No amendments proposed.</li> : null}
        </ul>
      </section>

      {financingEnabled ? (
        <section className="rounded-xl border border-border bg-surface p-6 text-sm">
          <h2 className="font-display text-lg font-medium">Financing partner interface</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Records an application for review only. No partner call, credit decision or money
            movement is performed.
          </p>
          <div className="mt-3">
            <FinancingApplicationForm
              businessId={id}
              agreementId={agreementId}
              currency={agreement.currency}
            />
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {applications.map((application) => (
              <li key={application.id}>
                {application.applicationNumber} · {application.partnerCode} ·{" "}
                {application.requestedAmount} {application.currency} · {application.status}
              </li>
            ))}
            {applications.length === 0 ? <li>No applications submitted.</li> : null}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Open a dispute</h2>
        <div className="mt-4 max-w-lg">
          <OpenInstallmentDisputeForm businessId={id} agreementId={agreementId} compact />
        </div>
      </section>
    </PageShell>
  );
}
