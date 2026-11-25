import "server-only";

import type { DeliveryOpportunityStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface OpportunityView {
  id: string;
  opportunityNumber: string;
  requestNumber: string;
  status: DeliveryOpportunityStatus;
  pickupName: string;
  dropoffName: string;
  distanceKm: string;
  fee: string;
  currency: string;
  vehicleType: string | null;
  offeredToName: string | null;
  expiresAt: string;
  createdAt: string;
}

function toView(row: {
  id: string;
  opportunityNumber: string;
  status: DeliveryOpportunityStatus;
  pickupName: string;
  dropoffName: string;
  distanceKm: { toString(): string };
  fee: { toString(): string };
  currency: string;
  requiredVehicleType: string | null;
  expiresAt: Date;
  createdAt: Date;
  request: { requestNumber: string };
  offeredTo: { name: string } | null;
}): OpportunityView {
  return {
    id: row.id,
    opportunityNumber: row.opportunityNumber,
    requestNumber: row.request.requestNumber,
    status: row.status,
    pickupName: row.pickupName,
    dropoffName: row.dropoffName,
    distanceKm: row.distanceKm.toString(),
    fee: row.fee.toString(),
    currency: row.currency,
    vehicleType: row.requiredVehicleType,
    offeredToName: row.offeredTo?.name ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const include = {
  request: { select: { requestNumber: true } },
  offeredTo: { select: { name: true } },
} as const;

export async function listOpenOpportunities(): Promise<OpportunityView[]> {
  const rows = await getDatabase().deliveryOpportunity.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include,
  });
  return rows.map(toView);
}

export async function listCompanyOpportunities(companyId: string): Promise<OpportunityView[]> {
  const rows = await getDatabase().deliveryOpportunity.findMany({
    where: { offeredToId: companyId },
    orderBy: { createdAt: "desc" },
    include,
  });
  return rows.map(toView);
}

export async function listOfferedOpportunities(): Promise<OpportunityView[]> {
  const rows = await getDatabase().deliveryOpportunity.findMany({
    where: { status: "OFFERED" },
    orderBy: { offeredAt: "desc" },
    include,
  });
  return rows.map(toView);
}

export async function getOpportunityScores(opportunityId: string) {
  const rows = await getDatabase().logisticsCompanyOfferScore.findMany({
    where: { opportunityId },
    orderBy: [{ rank: "asc" }, { companyId: "asc" }],
    include: { company: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    score: row.score.toString(),
    eligible: row.eligible,
    rank: row.rank,
    coverageKm: row.coverageKm?.toString() ?? null,
    capacityCount: row.capacityCount,
    vehicleMatch: row.vehicleMatch,
    reliabilityBps: row.reliabilityBps,
  }));
}
