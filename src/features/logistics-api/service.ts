import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/features/security/secret-crypto";
import { hmacSha256Hex } from "@/server/payments/lynxpay/signatures";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { appendOutboxEvent } from "@/features/outbox/service";
import { getDatabase } from "@/server/db/client";

import { apiDeliveryRequestSchema, externalOrderSchema } from "./validation";

const decimal = (value: number) => new Prisma.Decimal(value);
const NO_STORE = { "Cache-Control": "no-store" } as const;

export function hashRequestBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

/** Creates an API key and returns the one-time plaintext secret. */
export async function createApiKey(
  companyId: string,
  actorId: string,
  name: string,
  scopes: readonly string[],
  hashSecret: (secret: string) => string,
): Promise<{ keyId: string; secret: string }> {
  const keyId = `lsk_${randomBytes(6).toString("base64url")}`;
  const secret = randomBytes(24).toString("base64url");
  await getDatabase().$transaction(async (tx) => {
    await tx.logisticsApiKey.create({
      data: {
        keyId,
        name,
        companyId,
        scopes: [...scopes],
        secretHash: hashSecret(secret),
        createdById: actorId,
      },
    });
    await recordAuditEvent(tx, {
      actorId,
      action: "LOGISTICS_API_KEY_CREATED",
      targetType: "LogisticsCompany",
      targetId: companyId,
      metadata: { companyId, keyId, scopes: [...scopes] },
    });
  });
  return { keyId, secret: `${keyId}.${secret}` };
}

/** Idempotent delivery request creation scoped to the authenticated company. */
export async function createApiDeliveryRequest(
  companyId: string,
  body: unknown,
  idempotencyKey: string,
): Promise<
  | { ok: true; result: { requestId: string; requestNumber: string }; replayed: boolean }
  | { ok: false; status: number; error: string }
> {
  const parsed = apiDeliveryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid request body." };
  }
  if (idempotencyKey.length > 160) {
    return { ok: false, status: 400, error: "Idempotency-Key is too long." };
  }

  const database = getDatabase();
  const data = parsed.data;
  const requestHash = hashRequestBody(data);

  const cached = await database.logisticsApiRequest.findUnique({
    where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
    select: { requestHash: true, responseStatus: true, responseBody: true },
  });
  if (cached) {
    if (cached.requestHash !== requestHash) {
      return { ok: false, status: 409, error: "Idempotency-Key was used with a different body." };
    }
    return {
      ok: true,
      replayed: true,
      result: cached.responseBody as { requestId: string; requestNumber: string },
    };
  }

  try {
    const result = await database.$transaction(async (tx) => {
      const existing = await tx.deliveryRequest.findUnique({
        where: { externalRef: data.externalRef },
        select: { id: true, requestNumber: true, requesterId: true },
      });
      if (existing) {
        // externalRef is globally unique; only the owning company may reuse it.
        const owns = await tx.deliveryRequest.findFirst({
          where: { id: existing.id, companyId },
          select: { id: true },
        });
        if (!owns) return { conflict: true as const };
        return {
          requestId: existing.id,
          requestNumber: existing.requestNumber,
          alreadyExists: true,
        };
      }

      const owner = await tx.logisticsCompanyMember.findFirst({
        where: { companyId, status: "ACTIVE" },
        select: { userId: true },
      });
      if (!owner) return { noOwner: true as const };

      const request = await tx.deliveryRequest.create({
        data: {
          requestNumber: makeDocumentNumber("ER"),
          externalRef: data.externalRef,
          source: "COMPANY",
          companyId,
          requesterId: owner.userId,
          pickupName: data.pickupName,
          pickupPhone: data.pickupPhone ?? null,
          pickupAddress: data.pickupAddress,
          pickupLatitude: decimal(data.pickup.latitude),
          pickupLongitude: decimal(data.pickup.longitude),
          dropoffName: data.dropoffName,
          dropoffPhone: data.dropoffPhone ?? null,
          dropoffAddress: data.dropoffAddress,
          dropoffLatitude: decimal(data.dropoff.latitude),
          dropoffLongitude: decimal(data.dropoff.longitude),
          distanceKm: decimal(0),
          fee: decimal(0),
          currency: data.currency,
          status: "PENDING",
          note: data.note ?? null,
        },
        select: { id: true, requestNumber: true },
      });
      await tx.logisticsApiRequest.create({
        data: {
          idempotencyKey,
          companyId,
          endpoint: "POST /api/v1/logistics/delivery-requests",
          requestHash,
          responseStatus: 201,
          responseBody: { requestId: request.id, requestNumber: request.requestNumber },
        },
      });
      await recordAuditEvent(tx, {
        actorId: null,
        action: "DELIVERY_REQUEST_CREATED",
        targetType: "DeliveryRequest",
        targetId: request.id,
        metadata: { companyId, externalRef: data.externalRef },
      });
      return { requestId: request.id, requestNumber: request.requestNumber };
    });

    if ("conflict" in result) {
      return { ok: false, status: 409, error: "externalRef belongs to another company." };
    }
    if ("noOwner" in result) {
      return { ok: false, status: 403, error: "The company has no active member." };
    }
    return { ok: true, replayed: false, result };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, status: 409, error: "externalRef is already in use." };
    }
    return { ok: false, status: 500, error: "The delivery request could not be created." };
  }
}

/** Creates or updates an external store from a signed order webhook. */
export async function ingestExternalOrder(
  storeId: string,
  companyId: string,
  body: unknown,
): Promise<
  { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string }
> {
  const parsed = externalOrderSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: "Invalid order payload." };

  const result = await getDatabase().$transaction(async (tx) => {
    const store = await tx.logisticsExternalStore.findFirst({
      where: { id: storeId, companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!store) return { error: "External store not found." as const };

    const data = parsed.data;
    const order = await tx.logisticsExternalOrder.upsert({
      where: {
        storeId_externalOrderId: { storeId, externalOrderId: data.externalOrderId },
      },
      create: {
        storeId,
        externalOrderId: data.externalOrderId,
        status: "RECEIVED",
        payload: data,
      },
      update: { status: "RECEIVED", payload: data },
      select: { id: true, externalOrderId: true },
    });

    await appendOutboxEvent(tx, {
      eventType: "logistics.external_order.received",
      aggregateType: "LogisticsExternalOrder",
      aggregateId: order.id,
      payload: { storeId, externalOrderId: order.externalOrderId },
    });

    return { order };
  });

  if ("error" in result)
    return { ok: false, status: 404, error: result.error ?? "External store not found." };
  return { ok: true, status: 200, data: { orderId: result.order.id, status: "RECEIVED" } };
}

/** Stores an encrypted endpoint secret and returns it once for display. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function encryptWebhookSecret(secret: string): string {
  return encryptIntegrationSecret(secret);
}

export function decryptWebhookSecret(stored: string): string {
  return decryptIntegrationSecret(stored);
}

export function signWebhookPayload(secret: string, timestamp: number, rawBody: string): string {
  return `sha256=${hmacSha256Hex(secret, `${timestamp}.${rawBody}`)}`;
}

export const NO_STORE_HEADERS = NO_STORE;
