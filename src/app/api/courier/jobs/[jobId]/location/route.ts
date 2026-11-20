import { connection } from "next/server";
import { z } from "zod";

import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

const headers = { "Cache-Control": "no-store" };

const pingSchema = z.object({
  jobId: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
});

const ACTIVE_STATUSES = ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] as const;

/**
 * Lightweight location ping used by the courier app's GPS loop. Authorization
 * is derived from the session agent and the job assignment — the client never
 * supplies an agent id.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  await connection();
  const { jobId } = await context.params;

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

  const parsed = pingSchema.safeParse({ ...(body as object), jobId });
  if (!parsed.success) {
    return Response.json({ error: "Invalid location." }, { status: 400, headers });
  }

  const database = getDatabase();
  const agent = await database.deliveryAgent.findFirst({
    where: { userId: actor.id, verification: "APPROVED" },
    select: { id: true },
  });
  if (!agent) {
    return Response.json({ error: "You are not a verified courier." }, { status: 403, headers });
  }

  const job = await database.deliveryJob.findFirst({
    where: {
      id: parsed.data.jobId,
      agentId: agent.id,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { id: true },
  });
  if (!job) {
    return Response.json({ error: "You are not on this delivery." }, { status: 403, headers });
  }

  const toDecimal = (value: number) => String(value);
  await database.$transaction([
    database.deliveryLocation.create({
      data: {
        jobId: job.id,
        agentId: agent.id,
        latitude: toDecimal(parsed.data.latitude),
        longitude: toDecimal(parsed.data.longitude),
        heading: parsed.data.heading !== undefined ? toDecimal(parsed.data.heading) : null,
      },
    }),
    database.deliveryAgent.update({
      where: { id: agent.id },
      data: {
        latitude: toDecimal(parsed.data.latitude),
        longitude: toDecimal(parsed.data.longitude),
      },
    }),
  ]);

  return Response.json({ ok: true }, { headers });
}
