import { connection } from "next/server";

import { getAgentJob, getCustomerJob } from "@/features/logistics/queries";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

const headers = { "Cache-Control": "no-store" };

/**
 * Real-time tracking endpoint. Callers must be the requester, the assigned
 * agent, or an admin — never an anonymous reader of another customer's order.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  await connection();
  const { jobId } = await context.params;

  const actor = await getSessionActor();
  if (!actor) {
    return Response.json({ error: "Authentication required." }, { status: 401, headers });
  }

  if (actor.role === "ADMIN") {
    const job = await getDatabase().deliveryJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        agentId: true,
        otpCode: true,
        otpExpiresAt: true,
        assignedAt: true,
        acceptedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        cancelledAt: true,
        request: {
          select: {
            requesterId: true,
            pickupName: true,
            pickupAddress: true,
            pickupLatitude: true,
            pickupLongitude: true,
            dropoffName: true,
            dropoffAddress: true,
            dropoffLatitude: true,
            dropoffLongitude: true,
            distanceKm: true,
            fee: true,
            currency: true,
            requestNumber: true,
            order: { select: { orderNumber: true } },
          },
        },
        agent: { select: { name: true } },
        locations: {
          orderBy: { recordedAt: "desc" },
          take: 1,
          select: { latitude: true, longitude: true, heading: true, recordedAt: true },
        },
      },
    });
    if (!job) return Response.json({ error: "Job not found." }, { status: 404, headers });
    return Response.json(job, { headers });
  }

  const customerJob = await getCustomerJob(jobId, actor.id);
  if (customerJob) return Response.json(customerJob, { headers });

  const agent = await getDatabase().deliveryAgent.findFirst({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (agent) {
    const job = await getAgentJob(jobId, agent.id);
    if (job) return Response.json(job, { headers });
  }

  return Response.json({ error: "Job not found." }, { status: 404, headers });
}
