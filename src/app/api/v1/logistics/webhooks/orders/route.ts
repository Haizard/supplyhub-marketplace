import { connection } from "next/server";

import { isFeatureEnabled } from "@/features/flags/service";
import {
  decryptWebhookSecret,
  ingestExternalOrder,
  NO_STORE_HEADERS,
} from "@/features/logistics-api/service";
import { logger } from "@/lib/logging/logger";
import { getDatabase } from "@/server/db/client";
import {
  consumeRateLimit,
  getClientAddress,
  LOGISTICS_WEBHOOK_RATE_LIMIT,
} from "@/server/security/rate-limit";
import { verifyWebhookSignature } from "@/server/logistics/api-auth";

const MAX_BODY_BYTES = 32_000;

/** Signed webhook from an external e-commerce store into the logistics network. */
export async function POST(request: Request): Promise<Response> {
  await connection();

  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return Response.json(
      { error: "The logistics network is not enabled." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const address = await getClientAddress();
  if (!consumeRateLimit(`logistics-webhook:${address}`, LOGISTICS_WEBHOOK_RATE_LIMIT)) {
    return Response.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const storeId = request.headers.get("x-supplyhub-store-id") ?? "";
  if (!storeId) {
    return Response.json(
      { error: "X-SupplyHub-Store-Id is required." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json(
      { error: "Payload too large." },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  const store = await getDatabase().logisticsExternalStore.findUnique({
    where: { id: storeId },
    select: { id: true, companyId: true, webhookSecret: true, status: true },
  });
  if (!store || store.status !== "ACTIVE") {
    return Response.json(
      { error: "Unknown or disconnected store." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  let secret: string;
  try {
    secret = decryptWebhookSecret(store.webhookSecret);
  } catch {
    logger.error("logistics.webhook_secret_undecryptable", { storeId });
    return Response.json(
      { error: "Webhook verification unavailable." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  if (
    !verifyWebhookSignature(
      secret,
      raw,
      request.headers.get("x-supplyhub-signature"),
      request.headers.get("x-supplyhub-timestamp"),
    )
  ) {
    return Response.json(
      { error: "Invalid webhook signature." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const result = await ingestExternalOrder(store.id, store.companyId, body);
  return Response.json(result.ok ? result.data : { error: result.error }, {
    status: result.status,
    headers: NO_STORE_HEADERS,
  });
}
