import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ContractForm, DeliveryRecordForm } from "@/components/logistics/contract-forms";
import { Badge } from "@/components/ui/badge";
import { ConsolePageHeader } from "@/components/logistics/console-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { listCompanyClients } from "@/features/logistics-clients/queries";
import { getContractDetail } from "@/features/logistics-contracts/queries";
import { contractProgress, isExpiringSoon } from "@/features/logistics-contracts/pricing";
import { CONTRACT_STATUS_LABELS } from "@/features/logistics-contracts/status";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Contract detail",
  robots: { index: false, follow: false },
};

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ companyId: string; contractId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <ContractDetailContent params={params} />
    </Suspense>
  );
}

async function ContractDetailContent({
  params,
}: {
  params: Promise<{ companyId: string; contractId: string }>;
}) {
  const { companyId, contractId } = await params;
  if (!uuidSchema.safeParse(companyId).success || !uuidSchema.safeParse(contractId).success) {
    notFound();
  }
  await requireLogisticsAccess(
    "logistics.contract.manage",
    companyId,
    `/logistics/${companyId}/contracts`,
  );
  const [company, contract, clients] = await Promise.all([
    getLogisticsCompany(companyId),
    getContractDetail(contractId, companyId),
    listCompanyClients(companyId),
  ]);
  if (!company || !contract) notFound();

  const progress = contractProgress(contract.deliveredCount, contract.monthlyAllocation);
  const expiring = isExpiringSoon(contract.endsAt);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Contract"
        title={contract.title}
        description={`${contract.contractNumber} · ${contract.clientName} · version ${contract.version}`}
        actions={
          <>
            <Badge tone={contract.status === "ACTIVE" ? "success" : "neutral"}>
              {CONTRACT_STATUS_LABELS[contract.status]}
            </Badge>
            {expiring ? <Badge tone="neutral">Expiring soon</Badge> : null}
          </>
        }
      />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Performance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {contract.deliveredCount} delivery(ies)
          {progress.remaining !== null
            ? ` · ${progress.remaining} remaining (${progress.percent}%)`
            : " · no fixed allocation"}
        </p>
        {progress.remaining !== null ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        ) : null}
        {contract.sla ? (
          <p className="mt-3 text-xs text-muted-foreground">
            SLA: {contract.sla.maxDeliveryHours ?? "—"}h max · completion ≥{" "}
            {contract.sla.minCompletionRateBps === null
              ? "—"
              : `${contract.sla.minCompletionRateBps / 100}%`}{" "}
            · proof {contract.sla.proofRequired ? "required" : "optional"} · OTP{" "}
            {contract.sla.otpRequired ? "required" : "optional"}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Deliveries</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {contract.deliveries.map((delivery) => (
            <li key={delivery.id}>
              {delivery.reference} · {delivery.charge} {contract.currency} · {delivery.status}
            </li>
          ))}
          {contract.deliveries.length === 0 ? (
            <li className="text-muted-foreground">None recorded.</li>
          ) : null}
        </ul>
        {contract.status === "ACTIVE" ? (
          <div className="mt-4 border-t border-border pt-4">
            <DeliveryRecordForm companyId={companyId} contractId={contractId} />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Version history</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {contract.versions.map((version) => (
            <li key={version.id}>
              v{version.version} · {version.status} ·{" "}
              {new Date(version.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-3xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Edit draft</h2>
        {contract.status === "DRAFT" ? (
          <div className="mt-4">
            <ContractForm companyId={companyId} clients={clients} contract={contract} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Only draft contracts can be edited. Create a revision to change an active agreement.
          </p>
        )}
      </section>
    </div>
  );
}
