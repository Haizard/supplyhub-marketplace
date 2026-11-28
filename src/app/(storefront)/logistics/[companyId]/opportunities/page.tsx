import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  AcceptOpportunityForm,
  DeclineOpportunityForm,
} from "@/components/logistics/marketplace-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/console/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { listCompanyOpportunities } from "@/features/logistics-marketplace/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Delivery opportunities",
  robots: { index: false, follow: false },
};

export default function CompanyOpportunitiesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <CompanyOpportunitiesContent params={params} />
    </Suspense>
  );
}

async function CompanyOpportunitiesContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.dispatch.manage",
    companyId,
    `/logistics/${companyId}/opportunities`,
  );
  const [company, opportunities] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyOpportunities(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Delivery opportunities"
        description="Platform-generated work offered to verified companies. You decide what to accept."
      />

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No opportunities offered yet.</p>
      ) : (
        <ul className="space-y-3">
          {opportunities.map((opportunity) => (
            <li
              key={opportunity.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-medium">{opportunity.opportunityNumber}</p>
                  <p className="text-sm">
                    {opportunity.pickupName} → {opportunity.dropoffName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {opportunity.distanceKm} km · {opportunity.fee} {opportunity.currency} · expires{" "}
                    {new Date(opportunity.expiresAt).toLocaleString()}
                  </p>
                </div>
                <Badge tone={opportunity.status === "ACCEPTED" ? "success" : "neutral"}>
                  {opportunity.status}
                </Badge>
              </div>
              {opportunity.status === "OFFERED" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <AcceptOpportunityForm companyId={companyId} opportunityId={opportunity.id} />
                  <DeclineOpportunityForm companyId={companyId} opportunityId={opportunity.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
