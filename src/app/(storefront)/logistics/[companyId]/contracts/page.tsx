import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ContractForm, ContractStatusForm } from "@/components/logistics/contract-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/logistics/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { listCompanyClients } from "@/features/logistics-clients/queries";
import { listContracts } from "@/features/logistics-contracts/queries";
import { CONTRACT_STATUS_LABELS } from "@/features/logistics-contracts/status";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company contracts",
  robots: { index: false, follow: false },
};

export default function CompanyContractsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyContractsContent params={params} />
    </Suspense>
  );
}

async function CompanyContractsContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.contract.manage",
    companyId,
    `/logistics/${companyId}/contracts`,
  );
  const [company, contracts, clients] = await Promise.all([
    getLogisticsCompany(companyId),
    listContracts(companyId),
    listCompanyClients(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Contracts"
        description="Commercial agreements, pricing, SLAs and delivery allocation."
      />

      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contracts yet.</p>
      ) : (
        <ul className="space-y-3">
          {contracts.map((contract) => (
            <li
              key={contract.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/logistics/${companyId}/contracts/${contract.id}`}
                    className="font-mono text-sm font-medium hover:underline"
                  >
                    {contract.contractNumber}
                  </Link>
                  <p className="font-medium">{contract.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {contract.clientName} · {contract.deliveredCount} delivery(ies)
                    {contract.monthlyAllocation ? ` / ${contract.monthlyAllocation} allocated` : ""}
                  </p>
                </div>
                <Badge tone={contract.status === "ACTIVE" ? "success" : "neutral"}>
                  {CONTRACT_STATUS_LABELS[contract.status]}
                </Badge>
              </div>
              <ContractStatusForm companyId={companyId} contract={contract} />
            </li>
          ))}
        </ul>
      )}

      <section className="max-w-3xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">New contract</h2>
        <div className="mt-4">
          <ContractForm companyId={companyId} clients={clients} />
        </div>
      </section>
    </div>
  );
}
