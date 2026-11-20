import { connection } from "next/server";
import { z } from "zod";

import { createExternalDeliveryRequest } from "@/features/logistics/actions";
import { getRequest } from "@/features/logistics/queries";
import { getServerEnv } from "@/lib/config/env";
import { getSessionActor } from "@/server/auth/session";

const headers = { "Cache-Control": "no-store" };

const createBodySchema = z.object({
  externalRef: z.string().trim().min(3).max(120),
  businessId: z.uuid().optional(),
  pickupName: z.string().trim().min(1).max(100),
  pickupPhone: z.string().trim().max(30).optional(),
  pickupAddress: z.string().trim().min(1).max(300),
  pickup: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  dropoffName: z.string().trim().min(1).max(100),
  dropoffPhone: z.string().trim().max(30).optional(),
  dropoffAddress: z.string().trim().min(1).max(300),
  dropoff: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: z.string().trim().max(500).optional(),
});

/**
 * External delivery request API. Authentication is the normal SupplyHub
 * session — a business logs in and uses its own requester identity. No new
 * API-key or settlement policy is invented; those remain unresolved in
 * docs/01-product-vision.md.
 */
export async function POST(request: Request): Promise<Response> {
  await connection();

  const actor = await getSessionActor();
  if (!actor) {
    return Response.json({ error: "Authentication required." }, { status: 401, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400, headers });
  }

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400, headers });
  }

  // A businessId supplied by the caller must match a business the actor belongs to.
  if (parsed.data.businessId && actor.business?.id !== parsed.data.businessId) {
    return Response.json(
      { error: "You cannot request deliveries for that business." },
      { status: 403, headers },
    );
  }

  const result = await createExternalDeliveryRequest({
    ...parsed.data,
    requesterId: actor.id,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500, headers });
  }

  return Response.json(
    {
      requestId: result.requestId,
      requestNumber: result.requestNumber,
      status: "PENDING",
    },
    { status: 201, headers },
  );
}

/** Idempotent status lookup for external clients, scoped to the requester. */
export async function GET(request: Request): Promise<Response> {
  await connection();

  const actor = await getSessionActor();
  if (!actor) {
    return Response.json({ error: "Authentication required." }, { status: 401, headers });
  }

  const url = new URL(request.url);
  const externalRef = url.searchParams.get("externalRef")?.trim() ?? "";
  if (!externalRef || externalRef.length > 120) {
    return Response.json({ error: "externalRef is required." }, { status: 400, headers });
  }

  const { getDatabase } = await import("@/server/db/client");
  const row = await getDatabase().deliveryRequest.findUnique({
    where: { externalRef },
    select: { id: true, requesterId: true },
  });
  if (!row || row.requesterId !== actor.id) {
    return Response.json({ error: "Delivery request not found." }, { status: 404, headers });
  }

  const detail = await getRequest(row.id, actor.id);
  return Response.json(detail, { headers });
}

/** Service health hint for external clients; never exposes secrets. */
export async function OPTIONS(): Promise<Response> {
  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
  return Response.json({ service: "supplyhub-delivery", siteUrl }, { headers });
}
