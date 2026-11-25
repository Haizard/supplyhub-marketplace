import "server-only";

import { getDatabase } from "@/server/db/client";

export interface ShareVehicleView {
  id: string;
  plate: string;
  active: boolean;
}

export interface OpenUsageView {
  id: string;
  vehiclePlate: string;
  jobNumber: string | null;
  accountableCompanyId: string;
}

export interface ShareAgreementView {
  id: string;
  agreementNumber: string;
  type: string;
  status: string;
  direction: "OWNER" | "PARTNER";
  counterpartyName: string;
  accountableCompanyId: string;
  insurancePolicyRef: string | null;
  insuranceExpiresAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  ownerConsented: boolean;
  partnerConsented: boolean;
  vehicles: ShareVehicleView[];
  activeUsageCount: number;
  openUsages: OpenUsageView[];
}

export interface ShareableVehicleView {
  id: string;
  plate: string;
  type: string;
  status: string;
  insuranceExpiresAt: string | null;
}

export interface ParcelHubView {
  id: string;
  hubCode: string;
  name: string;
  address: string;
  city: string | null;
  capacity: number;
  storedCount: number;
  status: string;
}

export interface HandoverView {
  id: string;
  hubName: string;
  trackingRef: string;
  direction: string;
  status: string;
  receivedAt: string;
  releasedAt: string | null;
}

export interface ActiveJobView {
  id: string;
  jobNumber: string;
}

export async function listShareAgreements(companyId: string): Promise<ShareAgreementView[]> {
  const rows = await getDatabase().fleetShareAgreement.findMany({
    where: { OR: [{ ownerCompanyId: companyId }, { partnerCompanyId: companyId }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      agreementNumber: true,
      type: true,
      status: true,
      ownerCompanyId: true,
      ownerCompany: { select: { name: true } },
      partnerCompany: { select: { name: true } },
      accountableCompanyId: true,
      insurancePolicyRef: true,
      insuranceExpiresAt: true,
      effectiveFrom: true,
      effectiveTo: true,
      ownerConsentedAt: true,
      partnerConsentedAt: true,
      vehicles: {
        where: { active: true },
        orderBy: { addedAt: "asc" },
        select: { id: true, vehicle: { select: { plate: true } } },
      },
      usages: {
        where: { status: { in: ["RESERVED", "IN_USE"] } },
        select: {
          id: true,
          accountableCompanyId: true,
          vehicle: { select: { plate: true } },
          job: { select: { jobNumber: true } },
        },
      },
    },
  });

  return rows.map((row) => {
    const direction = row.ownerCompanyId === companyId ? "OWNER" : "PARTNER";
    return {
      id: row.id,
      agreementNumber: row.agreementNumber,
      type: row.type,
      status: row.status,
      direction,
      counterpartyName: direction === "OWNER" ? row.partnerCompany.name : row.ownerCompany.name,
      accountableCompanyId: row.accountableCompanyId,
      insurancePolicyRef: row.insurancePolicyRef,
      insuranceExpiresAt: row.insuranceExpiresAt?.toISOString() ?? null,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      ownerConsented: row.ownerConsentedAt !== null,
      partnerConsented: row.partnerConsentedAt !== null,
      vehicles: row.vehicles.map((vehicle) => ({
        id: vehicle.id,
        plate: vehicle.vehicle.plate,
        active: true,
      })),
      activeUsageCount: row.usages.length,
      openUsages: row.usages.map((usage) => ({
        id: usage.id,
        vehiclePlate: usage.vehicle.plate,
        jobNumber: usage.job?.jobNumber ?? null,
        accountableCompanyId: usage.accountableCompanyId,
      })),
    };
  });
}

export async function listShareableVehicles(companyId: string): Promise<ShareableVehicleView[]> {
  const rows = await getDatabase().logisticsVehicle.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: { plate: "asc" },
    select: { id: true, plate: true, type: true, status: true, insuranceExpiresAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    plate: row.plate,
    type: row.type,
    status: row.status,
    insuranceExpiresAt: row.insuranceExpiresAt?.toISOString() ?? null,
  }));
}

export async function listParcelHubs(companyId: string): Promise<ParcelHubView[]> {
  const rows = await getDatabase().parcelHub.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      hubCode: true,
      name: true,
      address: true,
      city: true,
      capacity: true,
      status: true,
      _count: {
        select: { handovers: { where: { status: { in: ["RECEIVED", "STORED"] } } } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    hubCode: row.hubCode,
    name: row.name,
    address: row.address,
    city: row.city,
    capacity: row.capacity,
    storedCount: row._count.handovers,
    status: row.status,
  }));
}

export async function listParcelHandovers(companyId: string): Promise<HandoverView[]> {
  const rows = await getDatabase().parcelHubHandover.findMany({
    where: { companyId },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      trackingRef: true,
      direction: true,
      status: true,
      receivedAt: true,
      releasedAt: true,
      hub: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    hubName: row.hub.name,
    trackingRef: row.trackingRef,
    direction: row.direction,
    status: row.status,
    receivedAt: row.receivedAt.toISOString(),
    releasedAt: row.releasedAt?.toISOString() ?? null,
  }));
}

export async function listActiveCompanyJobs(companyId: string): Promise<ActiveJobView[]> {
  const rows = await getDatabase().deliveryJob.findMany({
    where: {
      companyId,
      status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true, jobNumber: true },
  });
  return rows;
}
