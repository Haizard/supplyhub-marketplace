import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";

import { MAX_OUTBOX_ATTEMPTS, nextAttemptDelayMs } from "./backoff";
import type { OutboxDispatchResult, OutboxEventView } from "./types";

export type OutboxHandler = (event: OutboxEventView) => Promise<void>;

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toView(row: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string | null;
  payload: Prisma.JsonValue;
  status: OutboxEventView["status"];
  attempts: number;
  availableAt: Date;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}): OutboxEventView {
  return {
    id: row.id,
    eventType: row.eventType,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload: jsonRecord(row.payload),
    status: row.status,
    attempts: row.attempts,
    availableAt: row.availableAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Built-in handlers are intentionally side-effect-light. Later Phase 7 slices
 * register domain handlers here instead of writing directly from request paths.
 */
const handlers: Record<string, OutboxHandler> = {
  "feature_flag.created": async (event) => {
    logger.info("outbox.feature_flag.created", { key: event.payload.key });
  },
  "feature_flag.updated": async (event) => {
    logger.info("outbox.feature_flag.updated", {
      key: event.payload.key,
      enabled: event.payload.enabled,
    });
  },
  // ── Phase 7 domain handlers ────────────────────────────────────────────
  "service_listing.created": async (event) => {
    logger.info("outbox.service_listing.created", {
      listingNumber: event.payload.listingNumber,
      vendorId: event.payload.vendorId,
    });
  },
  "service_listing.updated": async (event) => {
    logger.info("outbox.service_listing.updated", { id: event.aggregateId });
  },
  "service_booking.requested": async (event) => {
    logger.info("outbox.service_booking.requested", {
      bookingNumber: event.payload.bookingNumber,
      serviceId: event.payload.serviceId,
    });
  },
  "service_booking.confirmed": async (event) => {
    logger.info("outbox.service_booking.confirmed", { id: event.aggregateId });
  },
  "service_booking.cancelled": async (event) => {
    logger.info("outbox.service_booking.cancelled", { id: event.aggregateId });
  },
  "service_booking.completed": async (event) => {
    logger.info("outbox.service_booking.completed", { id: event.aggregateId });
  },
  "service_booking.no_show": async (event) => {
    logger.info("outbox.service_booking.no_show", { id: event.aggregateId });
  },
  "group_buy.campaign_created": async (event) => {
    logger.info("outbox.group_buy.campaign_created", {
      campaignNumber: event.payload.campaignNumber,
    });
  },
  "group_buy.campaign_updated": async (event) => {
    logger.info("outbox.group_buy.campaign_updated", { id: event.aggregateId });
  },
  "group_buy.joined": async (event) => {
    logger.info("outbox.group_buy.joined", {
      campaignId: event.payload.campaignId,
      buyerId: event.payload.buyerId,
      quantity: event.payload.quantity,
    });
  },
  "group_buy.left": async (event) => {
    logger.info("outbox.group_buy.left", { id: event.aggregateId });
  },
  "group_buy.campaign_funded": async (event) => {
    logger.info("outbox.group_buy.campaign_funded", {
      campaignId: event.payload.campaignId,
      totalQuantity: event.payload.totalQuantity,
    });
  },
  "regional_corridor.created": async (event) => {
    logger.info("outbox.regional_corridor.created", {
      corridorCode: event.payload.corridorCode,
    });
  },
  "regional_corridor.updated": async (event) => {
    logger.info("outbox.regional_corridor.updated", { id: event.aggregateId });
  },
  "regional_corridor.activated": async (event) => {
    logger.info("outbox.regional_corridor.activated", { id: event.aggregateId });
  },
  "regional_corridor.deactivated": async (event) => {
    logger.info("outbox.regional_corridor.deactivated", { id: event.aggregateId });
  },
  // Producers emit dotted event names; these aliases keep the queue drainable
  // for every event the Phase 7 actions actually append.
  "regional_corridor.status_changed": async (event) => {
    logger.info("outbox.regional_corridor.status_changed", {
      id: event.aggregateId,
      status: event.payload.status,
    });
  },
};

const handlerAliases: Record<string, string> = {
  "group_buy.campaign.created": "group_buy.campaign_created",
  "group_buy.campaign.updated": "group_buy.campaign_updated",
  "group_buy.campaign.activated": "group_buy.campaign_updated",
  "group_buy.campaign.cancelled": "group_buy.campaign_updated",
  "group_buy.participation.joined": "group_buy.joined",
  "group_buy.participation.left": "group_buy.left",
};
for (const [emitted, target] of Object.entries(handlerAliases)) {
  const handler = handlers[target];
  if (handler) handlers[emitted] = handler;
}

export function registerOutboxHandler(eventType: string, handler: OutboxHandler): void {
  handlers[eventType] = handler;
}

/** Call inside the producer's transaction so the event cannot be lost. */
export async function appendOutboxEvent(
  client: Prisma.TransactionClient,
  input: {
    eventType: string;
    aggregateType: string;
    aggregateId?: string | null;
    payload: Prisma.InputJsonValue;
  },
): Promise<void> {
  await client.outboxEvent.create({
    data: {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId ?? null,
      payload: input.payload,
    },
  });
}

export async function listOutboxEvents(limit = 50): Promise<OutboxEventView[]> {
  const rows = await getDatabase().outboxEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toView);
}

/** Publishes claimed events to registered handlers with bounded retries. */
export async function dispatchOutboxEvents(limit = 50): Promise<OutboxDispatchResult> {
  const database = getDatabase();
  const result: OutboxDispatchResult = { claimed: 0, published: 0, failed: 0, retryScheduled: 0 };
  const now = new Date();

  const candidates = await database.outboxEvent.findMany({
    where: { status: "PENDING", availableAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  if (candidates.length === 0) return result;

  const ids = candidates.map((row) => row.id);
  const claim = await database.outboxEvent.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  result.claimed = claim.count;
  if (claim.count === 0) return result;

  const events = await database.outboxEvent.findMany({
    where: { id: { in: ids }, status: "PROCESSING" },
    orderBy: { createdAt: "asc" },
  });

  for (const row of events) {
    const event = toView(row);
    const handler = handlers[event.eventType];
    let error: string | null = null;

    if (!handler) {
      error = `No handler registered for ${event.eventType}`;
    } else {
      try {
        await handler(event);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Unknown handler failure";
      }
    }

    await database.$transaction(async (tx) => {
      if (error) {
        const exhausted = event.attempts >= MAX_OUTBOX_ATTEMPTS;
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: exhausted ? "FAILED" : "PENDING",
            availableAt: exhausted
              ? new Date()
              : new Date(Date.now() + nextAttemptDelayMs(event.attempts)),
            lastError: error,
          },
        });
        await recordAuditEvent(tx, {
          actorId: null,
          action: "OUTBOX_EVENT_FAILED",
          targetType: "OutboxEvent",
          targetId: event.id,
          metadata: { eventType: event.eventType, attempts: event.attempts, error },
        });
        return;
      }

      await tx.outboxEvent.update({
        where: { id: event.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), lastError: null },
      });
      await recordAuditEvent(tx, {
        actorId: null,
        action: "OUTBOX_EVENT_DISPATCHED",
        targetType: "OutboxEvent",
        targetId: event.id,
        metadata: { eventType: event.eventType, attempts: event.attempts },
      });
    });

    if (error) {
      if (event.attempts >= MAX_OUTBOX_ATTEMPTS) result.failed += 1;
      else result.retryScheduled += 1;
    } else {
      result.published += 1;
    }
  }

  return result;
}
