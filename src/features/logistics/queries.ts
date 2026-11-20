import "server-only";

import type {
  AgentPresence,
  AgentVerificationStatus,
  DeliveryJobStatus,
  DeliveryRequestStatus,
  VerificationState,
} from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface AgentView {
  id: string;
  agentCode: string;
  name: string;
  phone: string;
  presence: AgentPresence;
  verification: AgentVerificationStatus;
  rating: string;
  completedTrips: number;
  vehicle: { type: string; plate: string } | null;
  serviceAreas: { label: string; radiusKm: string }[];
  documentCount: number;
  activeJobs: number;
}

export interface AgentListItem {
  id: string;
  agentCode: string;
  name: string;
  phone: string;
  presence: AgentPresence;
  verification: AgentVerificationStatus;
  rating: string;
  completedTrips: number;
  activeJobs: number;
}

export interface AgentDocumentView {
  id: string;
  agentId: string;
  agentName: string;
  type: string;
  storageKey: string;
  status: VerificationState;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface RequestView {
  id: string;
  requestNumber: string;
  status: DeliveryRequestStatus;
  pickupName: string;
  pickupAddress: string;
  pickupLatitude: string;
  pickupLongitude: string;
  dropoffName: string;
  dropoffAddress: string;
  dropoffLatitude: string;
  dropoffLongitude: string;
  distanceKm: string;
  fee: string;
  currency: string;
  note: string | null;
  createdAt: Date;
  orderNumber: string | null;
  businessName: string | null;
}

export interface JobView {
  id: string;
  jobNumber: string;
  status: DeliveryJobStatus;
  requestId: string;
  requestNumber: string;
  agentId: string | null;
  agentName: string | null;
  pickupName: string;
  pickupAddress: string;
  pickupLatitude: string;
  pickupLongitude: string;
  dropoffName: string;
  dropoffAddress: string;
  dropoffLatitude: string;
  dropoffLongitude: string;
  distanceKm: string;
  fee: string;
  currency: string;
  otpCode: string | null;
  otpExpiresAt: Date | null;
  assignedAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  requesterId: string;
  orderNumber: string | null;
  latestLocation: {
    latitude: string;
    longitude: string;
    heading: string | null;
    recordedAt: Date;
  } | null;
  history: {
    id: string;
    fromStatus: DeliveryJobStatus | null;
    toStatus: DeliveryJobStatus;
    note: string | null;
    createdAt: Date;
  }[];
  proofs: { id: string; type: string; storageKey: string | null; recordedAt: Date }[];
}

const jobSelect = {
  id: true,
  jobNumber: true,
  status: true,
  requestId: true,
  agentId: true,
  otpCode: true,
  otpExpiresAt: true,
  assignedAt: true,
  acceptedAt: true,
  pickedUpAt: true,
  deliveredAt: true,
  cancelledAt: true,
  agent: { select: { name: true } },
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
  locations: {
    orderBy: { recordedAt: "desc" },
    take: 1,
    select: { latitude: true, longitude: true, heading: true, recordedAt: true },
  },
  statusHistory: {
    orderBy: { createdAt: "asc" },
    select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
  },
  proofs: {
    orderBy: { recordedAt: "asc" },
    select: { id: true, type: true, storageKey: true, recordedAt: true },
  },
} as const;

function mapJob(row: {
  id: string;
  jobNumber: string;
  status: DeliveryJobStatus;
  requestId: string;
  agentId: string | null;
  otpCode: string | null;
  otpExpiresAt: Date | null;
  assignedAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  agent: { name: string } | null;
  request: {
    requesterId: string;
    pickupName: string;
    pickupAddress: string;
    pickupLatitude: { toString(): string };
    pickupLongitude: { toString(): string };
    dropoffName: string;
    dropoffAddress: string;
    dropoffLatitude: { toString(): string };
    dropoffLongitude: { toString(): string };
    distanceKm: { toString(): string };
    fee: { toString(): string };
    currency: string;
    requestNumber: string;
    order: { orderNumber: string } | null;
  };
  locations: {
    latitude: { toString(): string };
    longitude: { toString(): string };
    heading: { toString(): string } | null;
    recordedAt: Date;
  }[];
  statusHistory: {
    id: string;
    fromStatus: DeliveryJobStatus | null;
    toStatus: DeliveryJobStatus;
    note: string | null;
    createdAt: Date;
  }[];
  proofs: { id: string; type: string; storageKey: string | null; recordedAt: Date }[];
}): JobView {
  const latest = row.locations[0];
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    status: row.status,
    requestId: row.requestId,
    requestNumber: row.request.requestNumber,
    agentId: row.agentId,
    agentName: row.agent?.name ?? null,
    pickupName: row.request.pickupName,
    pickupAddress: row.request.pickupAddress,
    pickupLatitude: row.request.pickupLatitude.toString(),
    pickupLongitude: row.request.pickupLongitude.toString(),
    dropoffName: row.request.dropoffName,
    dropoffAddress: row.request.dropoffAddress,
    dropoffLatitude: row.request.dropoffLatitude.toString(),
    dropoffLongitude: row.request.dropoffLongitude.toString(),
    distanceKm: row.request.distanceKm.toString(),
    fee: row.request.fee.toString(),
    currency: row.request.currency,
    otpCode: row.otpCode,
    otpExpiresAt: row.otpExpiresAt,
    assignedAt: row.assignedAt,
    acceptedAt: row.acceptedAt,
    pickedUpAt: row.pickedUpAt,
    deliveredAt: row.deliveredAt,
    cancelledAt: row.cancelledAt,
    requesterId: row.request.requesterId,
    orderNumber: row.request.order?.orderNumber ?? null,
    latestLocation: latest
      ? {
          latitude: latest.latitude.toString(),
          longitude: latest.longitude.toString(),
          heading: latest.heading ? latest.heading.toString() : null,
          recordedAt: latest.recordedAt,
        }
      : null,
    history: row.statusHistory,
    proofs: row.proofs,
  };
}

export async function getAgentView(agentId: string): Promise<AgentView | null> {
  const row = await getDatabase().deliveryAgent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      agentCode: true,
      name: true,
      phone: true,
      presence: true,
      verification: true,
      rating: true,
      completedTrips: true,
      vehicle: { select: { type: true, plate: true } },
      serviceAreas: { select: { label: true, radiusKm: true } },
      _count: {
        select: {
          documents: true,
          currentJobs: {
            where: {
              status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
            },
          },
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    agentCode: row.agentCode,
    name: row.name,
    phone: row.phone,
    presence: row.presence,
    verification: row.verification,
    rating: row.rating.toString(),
    completedTrips: row.completedTrips,
    vehicle: row.vehicle ? { type: row.vehicle.type, plate: row.vehicle.plate } : null,
    serviceAreas: row.serviceAreas.map((area) => ({
      label: area.label,
      radiusKm: area.radiusKm.toString(),
    })),
    documentCount: row._count.documents,
    activeJobs: row._count.currentJobs,
  };
}

export async function listApprovedAgents(): Promise<AgentListItem[]> {
  const rows = await getDatabase().deliveryAgent.findMany({
    where: { verification: "APPROVED" },
    orderBy: [{ rating: "desc" }, { completedTrips: "desc" }],
    select: {
      id: true,
      agentCode: true,
      name: true,
      phone: true,
      presence: true,
      verification: true,
      rating: true,
      completedTrips: true,
      _count: {
        select: {
          currentJobs: {
            where: {
              status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
            },
          },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    agentCode: row.agentCode,
    name: row.name,
    phone: row.phone,
    presence: row.presence,
    verification: row.verification,
    rating: row.rating.toString(),
    completedTrips: row.completedTrips,
    activeJobs: row._count.currentJobs,
  }));
}

export async function listPendingAgents(): Promise<AgentListItem[]> {
  const rows = await getDatabase().deliveryAgent.findMany({
    where: { verification: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      agentCode: true,
      name: true,
      phone: true,
      presence: true,
      verification: true,
      rating: true,
      completedTrips: true,
      _count: { select: { currentJobs: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    agentCode: row.agentCode,
    name: row.name,
    phone: row.phone,
    presence: row.presence,
    verification: row.verification,
    rating: row.rating.toString(),
    completedTrips: row.completedTrips,
    activeJobs: row._count.currentJobs,
  }));
}

export async function listAgentDocuments(): Promise<AgentDocumentView[]> {
  const rows = await getDatabase().agentDocument.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      agentId: true,
      type: true,
      storageKey: true,
      status: true,
      reviewedAt: true,
      createdAt: true,
      agent: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    agentId: row.agentId,
    agentName: row.agent.name,
    type: row.type,
    storageKey: row.storageKey,
    status: row.status,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
  }));
}

export async function listRequests(customerId?: string): Promise<RequestView[]> {
  const rows = await getDatabase().deliveryRequest.findMany({
    where: customerId ? { requesterId: customerId } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      requestNumber: true,
      status: true,
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
      note: true,
      createdAt: true,
      order: { select: { orderNumber: true } },
      business: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status,
    pickupName: row.pickupName,
    pickupAddress: row.pickupAddress,
    pickupLatitude: row.pickupLatitude.toString(),
    pickupLongitude: row.pickupLongitude.toString(),
    dropoffName: row.dropoffName,
    dropoffAddress: row.dropoffAddress,
    dropoffLatitude: row.dropoffLatitude.toString(),
    dropoffLongitude: row.dropoffLongitude.toString(),
    distanceKm: row.distanceKm.toString(),
    fee: row.fee.toString(),
    currency: row.currency,
    note: row.note,
    createdAt: row.createdAt,
    orderNumber: row.order?.orderNumber ?? null,
    businessName: row.business?.name ?? null,
  }));
}

export async function getRequest(
  requestId: string,
  customerId?: string,
): Promise<RequestView | null> {
  const row = await getDatabase().deliveryRequest.findFirst({
    where: { id: requestId, ...(customerId ? { requesterId: customerId } : {}) },
    select: {
      id: true,
      requestNumber: true,
      status: true,
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
      note: true,
      createdAt: true,
      order: { select: { orderNumber: true } },
      business: { select: { name: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status,
    pickupName: row.pickupName,
    pickupAddress: row.pickupAddress,
    pickupLatitude: row.pickupLatitude.toString(),
    pickupLongitude: row.pickupLongitude.toString(),
    dropoffName: row.dropoffName,
    dropoffAddress: row.dropoffAddress,
    dropoffLatitude: row.dropoffLatitude.toString(),
    dropoffLongitude: row.dropoffLongitude.toString(),
    distanceKm: row.distanceKm.toString(),
    fee: row.fee.toString(),
    currency: row.currency,
    note: row.note,
    createdAt: row.createdAt,
    orderNumber: row.order?.orderNumber ?? null,
    businessName: row.business?.name ?? null,
  };
}

/** Customer-scoped job lookup. The OTP is only exposed through this guard. */
export async function getCustomerJob(jobId: string, customerId: string): Promise<JobView | null> {
  const row = await getDatabase().deliveryJob.findFirst({
    where: { id: jobId, request: { requesterId: customerId } },
    select: jobSelect,
  });
  return row ? mapJob(row) : null;
}

/** Agent-scoped job lookup — agents only ever see jobs assigned to them. */
export async function getAgentJob(jobId: string, agentId: string): Promise<JobView | null> {
  const row = await getDatabase().deliveryJob.findFirst({
    where: { id: jobId, agentId },
    select: jobSelect,
  });
  return row ? mapJob(row) : null;
}

export async function listAgentJobs(agentId: string): Promise<JobView[]> {
  const rows = await getDatabase().deliveryJob.findMany({
    where: { agentId },
    orderBy: { assignedAt: "desc" },
    select: jobSelect,
  });
  return rows.map(mapJob);
}

export async function listCustomerJobs(customerId: string): Promise<JobView[]> {
  const rows = await getDatabase().deliveryJob.findMany({
    where: { request: { requesterId: customerId } },
    orderBy: { assignedAt: "desc" },
    select: jobSelect,
  });
  return rows.map(mapJob);
}

export async function listDispatchCandidates(pickup: { latitude: number; longitude: number }) {
  const agents = await getDatabase().deliveryAgent.findMany({
    where: { verification: "APPROVED", presence: "ONLINE" },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      rating: true,
      completedTrips: true,
      serviceAreas: { select: { latitude: true, longitude: true, radiusKm: true } },
      currentJobs: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
        select: { id: true },
      },
    },
  });
  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    latitude: agent.latitude ? Number(agent.latitude.toString()) : null,
    longitude: agent.longitude ? Number(agent.longitude.toString()) : null,
    rating: Number(agent.rating.toString()),
    completedTrips: agent.completedTrips,
    serviceAreas: agent.serviceAreas.map((area) => ({
      latitude: Number(area.latitude.toString()),
      longitude: Number(area.longitude.toString()),
      radiusKm: Number(area.radiusKm.toString()),
    })),
    activeJobs: agent.currentJobs.length,
    pickup,
  }));
}

export async function listPricingRules() {
  return getDatabase().deliveryPricingRule.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function listAgentEarnings(agentId: string) {
  const rows = await getDatabase().agentEarning.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      job: { select: { jobNumber: true, status: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount.toString(),
    currency: row.currency,
    status: row.status,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    jobNumber: row.job.jobNumber,
    jobStatus: row.job.status,
  }));
}

export async function listAllEarnings() {
  const rows = await getDatabase().agentEarning.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      agent: { select: { id: true, name: true } },
      job: { select: { jobNumber: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount.toString(),
    currency: row.currency,
    status: row.status,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    agentId: row.agent.id,
    agentName: row.agent.name,
    jobNumber: row.job.jobNumber,
  }));
}
