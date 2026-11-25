import "server-only";

import type { DeliveryJobStatus, DeliveryRequestStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface CompanyRequestView {
  id: string;
  requestNumber: string;
  status: DeliveryRequestStatus;
  pickupName: string;
  pickupAddress: string;
  dropoffName: string;
  dropoffAddress: string;
  distanceKm: string;
  fee: string;
  currency: string;
  contractNumber: string | null;
  activeJobId: string | null;
  activeJobStatus: DeliveryJobStatus | null;
  createdAt: string;
}

export interface CompanyJobView {
  id: string;
  jobNumber: string;
  status: DeliveryJobStatus;
  requestNumber: string;
  pickupName: string;
  dropoffName: string;
  driverName: string | null;
  vehiclePlate: string | null;
  contractNumber: string | null;
  assignedAt: string;
  otpCode: string | null;
}

export async function listCompanyRequests(companyId: string): Promise<CompanyRequestView[]> {
  const rows = await getDatabase().deliveryRequest.findMany({
    where: { companyId, source: "COMPANY" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      requestNumber: true,
      status: true,
      pickupName: true,
      pickupAddress: true,
      dropoffName: true,
      dropoffAddress: true,
      distanceKm: true,
      fee: true,
      currency: true,
      createdAt: true,
      contract: { select: { contractNumber: true } },
      jobs: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
        select: { id: true, status: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status,
    pickupName: row.pickupName,
    pickupAddress: row.pickupAddress,
    dropoffName: row.dropoffName,
    dropoffAddress: row.dropoffAddress,
    distanceKm: row.distanceKm.toString(),
    fee: row.fee.toString(),
    currency: row.currency,
    contractNumber: row.contract?.contractNumber ?? null,
    activeJobId: row.jobs[0]?.id ?? null,
    activeJobStatus: row.jobs[0]?.status ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listCompanyJobs(companyId: string): Promise<CompanyJobView[]> {
  const rows = await getDatabase().deliveryJob.findMany({
    where: { companyId },
    orderBy: { assignedAt: "desc" },
    take: 100,
    select: {
      id: true,
      jobNumber: true,
      status: true,
      assignedAt: true,
      otpCode: true,
      request: { select: { requestNumber: true, pickupName: true, dropoffName: true } },
      driverMembership: {
        select: {
          driver: { select: { fullName: true } },
          assignments: {
            where: { status: "ACTIVE" },
            select: { vehicle: { select: { plate: true } } },
          },
        },
      },
      contract: { select: { contractNumber: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    jobNumber: row.jobNumber,
    status: row.status,
    requestNumber: row.request.requestNumber,
    pickupName: row.request.pickupName,
    dropoffName: row.request.dropoffName,
    driverName: row.driverMembership?.driver.fullName ?? null,
    vehiclePlate: row.driverMembership?.assignments[0]?.vehicle.plate ?? null,
    contractNumber: row.contract?.contractNumber ?? null,
    assignedAt: row.assignedAt.toISOString(),
    otpCode: row.otpCode,
  }));
}

export async function listDispatchDrivers(companyId: string) {
  const rows = await getDatabase().driverCompanyMembership.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      driver: { select: { id: true, fullName: true, rating: true } },
      assignments: {
        where: { status: "ACTIVE" },
        select: { vehicle: { select: { plate: true } } },
      },
      jobs: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
        select: { id: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.driver.fullName,
    rating: row.driver.rating.toString(),
    vehiclePlate: row.assignments[0]?.vehicle.plate ?? null,
    activeJobs: row.jobs.length,
  }));
}
