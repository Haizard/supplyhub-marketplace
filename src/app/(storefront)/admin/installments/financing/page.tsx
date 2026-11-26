import type { Metadata } from "next";
import { Suspense } from "react";

import { DecideFinancingForm, FundFinancingForm } from "@/components/installments/financing-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureEnabled } from "@/features/flags/service";
import { listAllInstallmentFinancingApplications } from "@/features/installments/contract-queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Installment financing",
  robots: { index: false, follow: false },
};

export default function AdminInstallmentFinancingPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAdmin();
  const enabled = await isFeatureEnabled("phase10.installmentFinancing");
  const applications = await listAllInstallmentFinancingApplications();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Installment financing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Request, decision, acceptance and funding records for the partner interface. This page
          never disburses funds or makes a credit decision for the platform.
        </p>
      </header>

      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The <code>phase10.installmentFinancing</code> flag is disabled. Enable it only after
          compliance approval.
        </p>
      ) : null}

      {applications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No financing applications yet.</p>
      ) : null}

      {applications.map((application) => (
        <article
          key={application.id}
          className="space-y-3 rounded-xl border border-border bg-surface p-5 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono">{application.applicationNumber}</p>
              <p className="text-xs text-muted-foreground">
                {application.sellerName} · buyer {application.buyerEmail} · partner{" "}
                {application.partnerCode} · requested {application.requestedAmount}{" "}
                {application.currency}
                {application.offeredAmount ? ` · offered ${application.offeredAmount}` : ""}
              </p>
            </div>
            <Badge tone={application.status === "FUNDED" ? "success" : "neutral"}>
              {application.status}
            </Badge>
          </div>
          {application.status === "SUBMITTED" ? (
            <DecideFinancingForm applicationId={application.id} />
          ) : null}
          {application.status === "ACCEPTED" ? (
            <FundFinancingForm applicationId={application.id} />
          ) : null}
          {application.providerReference ? (
            <p className="text-xs text-muted-foreground">
              Partner reference: {application.providerReference}
            </p>
          ) : null}
        </article>
      ))}
    </PageShell>
  );
}
