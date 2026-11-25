import "server-only";

import { getDatabase } from "@/server/db/client";

export interface ApiRequestView {
  id: string;
  requestId: string;
  requestNumber: string;
  status: string;
  externalRef: string | null;
  createdAt: string;
}

/** Status lookup scoped to the company that owns the API key. */
export async function getApiRequestStatus(
  companyId: string,
  externalRef: string,
): Promise<ApiRequestView | null> {
  const row = await getDatabase().deliveryRequest.findFirst({
    where: { externalRef, companyId },
    select: {
      id: true,
      requestNumber: true,
      status: true,
      externalRef: true,
      createdAt: true,
      jobs: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
        select: { status: true },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.id,
    requestNumber: row.requestNumber,
    status: row.jobs[0]?.status ?? row.status,
    externalRef: row.externalRef,
    createdAt: row.createdAt.toISOString(),
  };
}
