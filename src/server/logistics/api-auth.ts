import "server-only";

import { getServerEnv } from "@/lib/config/env";
import {
  consumeRateLimit,
  getClientAddress,
  LOGISTICS_API_RATE_LIMIT,
} from "@/server/security/rate-limit";
import { hmacSha256Hex, safeHexEqual } from "@/server/payments/lynxpay/signatures";
import { getDatabase } from "@/server/db/client";

export const API_SCOPES = [
  "delivery.requests:write",
  "delivery.requests:read",
  "webhooks:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export interface ApiPrincipal {
  keyId: string;
  companyId: string;
  scopes: ReadonlySet<string>;
}

export function hashApiSecret(secret: string): string {
  return hmacSha256Hex(`${getServerEnv().AUTH_SECRET}:logistics-api`, secret);
}

export function readBearer(header: string | null): { keyId: string; secret: string } | null {
  if (!header) return null;
  const match = /^Bearer (lsk_[a-zA-Z0-9_-]{4,40})\.([a-zA-Z0-9_-]{16,128})$/.exec(header.trim());
  const keyId = match?.[1];
  const secret = match?.[2];
  if (!keyId || !secret) return null;
  return { keyId, secret };
}

export async function authenticateApiKey(
  request: Request,
  requiredScope: ApiScope,
): Promise<{ ok: true; principal: ApiPrincipal } | { ok: false; status: number; error: string }> {
  const parsed = readBearer(request.headers.get("authorization"));
  if (!parsed) {
    return { ok: false, status: 401, error: "A valid bearer API key is required." };
  }

  const address = await getClientAddress();
  if (!consumeRateLimit(`logistics-api:${parsed.keyId}:${address}`, LOGISTICS_API_RATE_LIMIT)) {
    return { ok: false, status: 429, error: "Too many requests. Try again shortly." };
  }

  const key = await getDatabase().logisticsApiKey.findUnique({
    where: { keyId: parsed.keyId },
    select: {
      id: true,
      keyId: true,
      secretHash: true,
      companyId: true,
      scopes: true,
      status: true,
    },
  });
  if (!key || key.status !== "ACTIVE") {
    return { ok: false, status: 401, error: "Invalid or revoked API key." };
  }

  const expected = hashApiSecret(parsed.secret);
  if (!safeHexEqual(key.secretHash, expected)) {
    return { ok: false, status: 401, error: "Invalid or revoked API key." };
  }

  const scopes = new Set(
    Array.isArray(key.scopes)
      ? key.scopes.filter((scope): scope is string => typeof scope === "string")
      : [],
  );
  if (!scopes.has(requiredScope) && !scopes.has("*")) {
    return { ok: false, status: 403, error: `Missing required scope: ${requiredScope}.` };
  }

  await getDatabase().logisticsApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    ok: true,
    principal: { keyId: key.keyId, companyId: key.companyId, scopes },
  };
}

/** Verifies an inbound webhook signature over `${timestamp}.${rawBody}`. */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): boolean {
  if (!signatureHeader || !timestampHeader) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 5 * 60) return false;
  const expected = hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const received = signatureHeader.replace(/^sha256=/i, "");
  return safeHexEqual(expected, received);
}
