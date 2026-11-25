import { connection } from "next/server";

import { isFeatureEnabled } from "@/features/flags/service";
import { createApiDeliveryRequest, NO_STORE_HEADERS } from "@/features/logistics-api/service";
import { publishWebhookEvent } from "@/features/logistics-api/webhook-dispatch";
import { authenticateApiKey } from "@/server/logistics/api-auth";

/** Versioned external API. The company is derived from the API key, never the body. */
export async function POST(request: Request): Promise<Response> {
  await connection();

  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return Response.json(
      { error: "The logistics network is not enabled." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const auth = await authenticateApiKey(request, "delivery.requests:write");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!idempotencyKey || idempotencyKey.length > 160) {
    return Response.json(
      { error: "A valid Idempotency-Key header is required." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const result = await createApiDeliveryRequest(auth.principal.companyId, body, idempotencyKey);
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: NO_STORE_HEADERS },
    );
  }

  if (!result.replayed) {
    await publishWebhookEvent(auth.principal.companyId, "delivery.created", {
      requestId: result.result.requestId,
      requestNumber: result.result.requestNumber,
    });
  }

  return Response.json(
    { ...result.result, status: "PENDING", replayed: result.replayed },
    { status: result.replayed ? 200 : 201, headers: NO_STORE_HEADERS },
  );
}
