import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  ApiKeyForm,
  EndpointStatusForm,
  ExternalStoreForm,
  RevokeKeyForm,
  WebhookEndpointForm,
} from "@/components/logistics/integration-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/console/console-ui";
import {
  listApiKeys,
  listExternalStores,
  listWebhookDeliveries,
  listWebhookEndpoints,
} from "@/features/logistics-api/queries";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "External integrations",
  robots: { index: false, follow: false },
};

export default function IntegrationsPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <IntegrationsContent params={params} />
    </Suspense>
  );
}

async function IntegrationsContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.referral.manage",
    companyId,
    `/logistics/${companyId}/integrations`,
  );
  const [company, keys, endpoints, deliveries, stores] = await Promise.all([
    getLogisticsCompany(companyId),
    listApiKeys(companyId),
    listWebhookEndpoints(companyId),
    listWebhookDeliveries(companyId),
    listExternalStores(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="External integrations"
        description="Versioned API keys, signed webhooks and external store connections. The company is always derived from the key, never from the request body."
      />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">API keys</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2"
            >
              <div>
                <p className="font-mono">{key.keyId}</p>
                <p className="text-xs text-muted-foreground">
                  {key.name} · {key.scopes.join(", ")}
                  {key.lastUsedAt
                    ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={key.status === "ACTIVE" ? "success" : "neutral"}>{key.status}</Badge>
                {key.status === "ACTIVE" ? (
                  <RevokeKeyForm companyId={companyId} keyId={key.id} />
                ) : null}
              </div>
            </li>
          ))}
          {keys.length === 0 ? <li className="text-muted-foreground">No API keys yet.</li> : null}
        </ul>
        <div className="mt-5 border-t border-border pt-5">
          <ApiKeyForm companyId={companyId} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Webhook endpoints</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {endpoints.map((endpoint) => (
            <li
              key={endpoint.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2"
            >
              <div>
                <p className="break-all">{endpoint.url}</p>
                <p className="text-xs text-muted-foreground">
                  {endpoint.events.join(", ")} · {endpoint.deliveryCount} delivery(ies)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={endpoint.status === "ACTIVE" ? "success" : "neutral"}>
                  {endpoint.status}
                </Badge>
                <EndpointStatusForm
                  companyId={companyId}
                  endpointId={endpoint.id}
                  status={endpoint.status}
                />
              </div>
            </li>
          ))}
          {endpoints.length === 0 ? (
            <li className="text-muted-foreground">No endpoints registered.</li>
          ) : null}
        </ul>
        <div className="mt-5 border-t border-border pt-5">
          <WebhookEndpointForm companyId={companyId} />
        </div>
        {deliveries.length > 0 ? (
          <ul className="mt-5 space-y-1 border-t border-border pt-5 text-xs text-muted-foreground">
            {deliveries.map((delivery) => (
              <li key={delivery.id}>
                {delivery.eventType} · {delivery.status} · {delivery.attempts} attempt(s)
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">External stores</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {stores.map((store) => (
            <li
              key={store.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2"
            >
              <span>
                {store.name} · {store.platform} · {store.externalStoreId} · {store.orderCount}{" "}
                order(s)
              </span>
              <Badge tone={store.status === "ACTIVE" ? "success" : "neutral"}>{store.status}</Badge>
            </li>
          ))}
          {stores.length === 0 ? (
            <li className="text-muted-foreground">No external stores connected.</li>
          ) : null}
        </ul>
        <div className="mt-5 border-t border-border pt-5">
          <ExternalStoreForm companyId={companyId} />
        </div>
      </section>
    </div>
  );
}
