import { connection } from "next/server";

import { getApiRequestStatus } from "@/features/logistics-api/delivery";
import { NO_STORE_HEADERS } from "@/features/logistics-api/service";
import { authenticateApiKey } from "@/server/logistics/api-auth";

/** Idempotent status lookup. A company can only read its own requests. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalRef: string }> },
): Promise<Response> {
  await connection();

  const auth = await authenticateApiKey(request, "delivery.requests:read");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  const { externalRef } = await params;
  if (!externalRef || externalRef.length > 120) {
    return Response.json(
      { error: "Invalid externalRef." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const detail = await getApiRequestStatus(auth.principal.companyId, externalRef);
  if (!detail) {
    return Response.json(
      { error: "Delivery request not found." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  return Response.json(detail, { headers: NO_STORE_HEADERS });
}
