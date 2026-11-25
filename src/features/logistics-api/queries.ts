import "server-only";

import type {
  ApiKeyStatus,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
} from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface ApiKeyView {
  id: string;
  keyId: string;
  name: string;
  scopes: string[];
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface WebhookEndpointView {
  id: string;
  url: string;
  events: string[];
  status: WebhookEndpointStatus;
  deliveryCount: number;
  createdAt: string;
}

export interface WebhookDeliveryView {
  id: string;
  endpointId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

export interface ExternalStoreView {
  id: string;
  platform: string;
  externalStoreId: string;
  name: string;
  status: string;
  orderCount: number;
  createdAt: string;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function listApiKeys(companyId: string): Promise<ApiKeyView[]> {
  const rows = await getDatabase().logisticsApiKey.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    keyId: row.keyId,
    name: row.name,
    scopes: strings(row.scopes),
    status: row.status,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listWebhookEndpoints(companyId: string): Promise<WebhookEndpointView[]> {
  const rows = await getDatabase().logisticsWebhookEndpoint.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      status: true,
      createdAt: true,
      _count: { select: { deliveries: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    events: strings(row.events),
    status: row.status,
    deliveryCount: row._count.deliveries,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listWebhookDeliveries(companyId: string): Promise<WebhookDeliveryView[]> {
  const rows = await getDatabase().logisticsWebhookDelivery.findMany({
    where: { endpoint: { companyId } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    endpointId: row.endpointId,
    eventType: row.eventType,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listExternalStores(companyId: string): Promise<ExternalStoreView[]> {
  const rows = await getDatabase().logisticsExternalStore.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platform: true,
      externalStoreId: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    externalStoreId: row.externalStoreId,
    name: row.name,
    status: row.status,
    orderCount: row._count.orders,
    createdAt: row.createdAt.toISOString(),
  }));
}
