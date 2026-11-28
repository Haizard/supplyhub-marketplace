import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  ClientForm,
  ContactForm,
  RelationshipStatusForm,
} from "@/components/logistics/client-forms";
import { Badge } from "@/components/ui/badge";
import { ConsolePageHeader } from "@/components/logistics/console-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { getClientDetail } from "@/features/logistics-clients/queries";
import {
  CLIENT_STATUS_LABELS,
  RELATIONSHIP_STATUS_LABELS,
} from "@/features/logistics-clients/status";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Merchant client",
  robots: { index: false, follow: false },
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ companyId: string; clientId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <ClientDetailContent params={params} />
    </Suspense>
  );
}

async function ClientDetailContent({
  params,
}: {
  params: Promise<{ companyId: string; clientId: string }>;
}) {
  const { companyId, clientId } = await params;
  if (!uuidSchema.safeParse(companyId).success || !uuidSchema.safeParse(clientId).success) {
    notFound();
  }
  await requireLogisticsAccess(
    "logistics.client.manage",
    companyId,
    `/logistics/${companyId}/clients`,
  );
  const [company, client] = await Promise.all([
    getLogisticsCompany(companyId),
    getClientDetail(clientId, companyId),
  ]);
  if (!company || !client) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Client"
        title={client.name}
        description={`${client.clientNumber} · ${client.businessName || "Independent merchant"} · works with ${client.companyCount} company(ies)`}
        actions={
          <>
            <Badge tone="neutral">{CLIENT_STATUS_LABELS[client.status]}</Badge>
            <Badge tone={client.relationshipStatus === "ACTIVE" ? "success" : "neutral"}>
              {RELATIONSHIP_STATUS_LABELS[client.relationshipStatus ?? "PENDING"]}
            </Badge>
            <RelationshipStatusForm
              companyId={companyId}
              clientId={clientId}
              status={client.relationshipStatus ?? "PENDING"}
            />
          </>
        }
      />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Client details</h2>
        <div className="mt-4">
          <ClientForm companyId={companyId} client={client} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Contacts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {client.contacts.map((contact) => (
            <li key={contact.id}>
              {contact.name} {contact.isPrimary ? "(primary)" : ""} · {contact.role || "—"} ·{" "}
              {contact.phone || contact.email || "—"}
            </li>
          ))}
          {client.contacts.length === 0 ? (
            <li className="text-muted-foreground">No contacts added.</li>
          ) : null}
        </ul>
        <div className="mt-5 border-t border-border pt-5">
          <ContactForm companyId={companyId} clientId={clientId} />
        </div>
      </section>
    </div>
  );
}
