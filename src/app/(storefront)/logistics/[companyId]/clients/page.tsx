import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ClientForm } from "@/components/logistics/client-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/logistics/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { listCompanyClients } from "@/features/logistics-clients/queries";
import {
  CLIENT_STATUS_LABELS,
  RELATIONSHIP_STATUS_LABELS,
} from "@/features/logistics-clients/status";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Merchant clients",
  robots: { index: false, follow: false },
};

export default function CompanyClientsPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyClientsContent params={params} />
    </Suspense>
  );
}

async function CompanyClientsContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.client.manage",
    companyId,
    `/logistics/${companyId}/clients`,
  );
  const [company, clients] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyClients(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Merchant clients"
        description="Merchants can use your delivery service without listing on the marketplace. One merchant may work with several logistics companies."
      />

      {clients.length > 0 ? (
        <ul className="space-y-3">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <Link
                  href={`/logistics/${companyId}/clients/${client.id}`}
                  className="font-medium hover:underline"
                >
                  {client.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {client.clientNumber} · {client.businessName || client.city || "—"} ·{" "}
                  {client.contactCount} contact(s)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{CLIENT_STATUS_LABELS[client.status]}</Badge>
                <Badge tone={client.relationshipStatus === "ACTIVE" ? "success" : "neutral"}>
                  {RELATIONSHIP_STATUS_LABELS[client.relationshipStatus ?? "PENDING"]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No merchant clients registered yet.</p>
      )}

      <section className="max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Register a merchant client</h2>
        <div className="mt-4">
          <ClientForm companyId={companyId} />
        </div>
      </section>
      {!access.permissions.has("*") && !access.permissions.has("logistics.client.manage") ? (
        <p className="text-xs text-muted-foreground">Your role has read-only client access.</p>
      ) : null}
    </div>
  );
}
