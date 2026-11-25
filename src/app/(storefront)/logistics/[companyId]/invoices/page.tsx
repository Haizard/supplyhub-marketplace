import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyNav } from "@/components/logistics/company-nav";
import { InvoiceForm, InvoiceStatusForm } from "@/components/logistics/contract-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { listContracts, listInvoices } from "@/features/logistics-contracts/queries";
import { INVOICE_STATUS_LABELS } from "@/features/logistics-contracts/status";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Logistics invoices",
  robots: { index: false, follow: false },
};

export default function CompanyInvoicesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyInvoicesContent params={params} />
    </Suspense>
  );
}

async function CompanyInvoicesContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.finance.read",
    companyId,
    `/logistics/${companyId}/invoices`,
  );
  const [company, invoices, contracts] = await Promise.all([
    getLogisticsCompany(companyId),
    listInvoices(companyId),
    listContracts(companyId),
  ]);
  if (!company) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <Link
        href={`/logistics/${companyId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {company.name}
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company-to-merchant billing, separate from the platform ledger.
        </p>
      </header>
      <CompanyNav companyId={companyId} active="invoices" />

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices generated yet.</p>
      ) : (
        <ul className="space-y-3">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <p className="font-mono text-sm font-medium">{invoice.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {invoice.clientName} · {invoice.contractNumber} · {invoice.total}{" "}
                  {invoice.currency}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={invoice.status === "PAID" ? "success" : "neutral"}>
                  {INVOICE_STATUS_LABELS[invoice.status]}
                </Badge>
                <InvoiceStatusForm
                  companyId={companyId}
                  invoiceId={invoice.id}
                  status={invoice.status}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Generate an invoice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed contract deliveries in the period become invoice lines. Duplicate periods are
          rejected.
        </p>
        <div className="mt-4">
          <InvoiceForm companyId={companyId} contracts={contracts} />
        </div>
      </section>
    </PageShell>
  );
}
