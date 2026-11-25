import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";

import { decryptWebhookSecret, signWebhookPayload } from "./service";

const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 5000;

function nextDelay(attempts: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

/** Enqueues a signed webhook delivery for each active endpoint subscribed to the event. */
export async function publishWebhookEvent(
  companyId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const database = getDatabase();
  const endpoints = await database.logisticsWebhookEndpoint.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { id: true, events: true },
  });
  const matching = endpoints.filter((endpoint) => {
    const events = Array.isArray(endpoint.events)
      ? endpoint.events.filter((event): event is string => typeof event === "string")
      : [];
    return events.includes(eventType);
  });
  if (matching.length === 0) return 0;

  await database.logisticsWebhookDelivery.createMany({
    data: matching.map((endpoint) => ({
      endpointId: endpoint.id,
      eventType,
      payload: payload as Prisma.InputJsonValue,
      status: "PENDING" as const,
    })),
  });
  return matching.length;
}

/** Signs and POSTs pending deliveries, with bounded retries. */
export async function dispatchWebhookDeliveries(limit = 20): Promise<{
  delivered: number;
  failed: number;
  retried: number;
}> {
  const database = getDatabase();
  const result = { delivered: 0, failed: 0, retried: 0 };
  const due = await database.logisticsWebhookDelivery.findMany({
    where: { status: "PENDING", availableAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { endpoint: { select: { id: true, secret: true, url: true, companyId: true } } },
  });

  for (const delivery of due) {
    const attempts = delivery.attempts + 1;
    const rawBody = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);

    let error: string | null = null;
    try {
      const secret = decryptWebhookSecret(delivery.endpoint.secret);
      const response = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SupplyHub-Signature": signWebhookPayload(secret, timestamp, rawBody),
          "X-SupplyHub-Timestamp": String(timestamp),
          "X-SupplyHub-Event": delivery.eventType,
        },
        body: rawBody,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) error = `HTTP ${response.status}`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Delivery failed";
    }

    await database.$transaction(async (tx) => {
      if (error) {
        const exhausted = attempts >= MAX_ATTEMPTS;
        await tx.logisticsWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts,
            status: exhausted ? "FAILED" : "PENDING",
            availableAt: new Date(Date.now() + nextDelay(attempts)),
            lastError: error.slice(0, 500),
          },
        });
        if (exhausted) result.failed += 1;
        else result.retried += 1;
        return;
      }

      await tx.logisticsWebhookDelivery.update({
        where: { id: delivery.id },
        data: { attempts, status: "DELIVERED", deliveredAt: new Date(), lastError: null },
      });
      await recordAuditEvent(tx, {
        actorId: null,
        action: "LOGISTICS_WEBHOOK_DELIVERED",
        targetType: "LogisticsWebhookDelivery",
        targetId: delivery.id,
        metadata: { companyId: delivery.endpoint.companyId, eventType: delivery.eventType },
      });
      result.delivered += 1;
    });
  }

  if (due.length > 0) logger.info("logistics.webhooks.dispatched", result);
  return result;
}
