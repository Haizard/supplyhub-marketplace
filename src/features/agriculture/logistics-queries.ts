import "server-only";

import { getDatabase } from "@/server/db/client";

export interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export interface DeliveryView {
  id: string;
  requestNumber: string;
  cargoType: string;
  direction: string;
  quantity: string;
  unit: string;
  requestStatus: string;
  jobStatus: string | null;
  driverName: string | null;
  createdAt: string;
}

export interface IntakeView {
  id: string;
  centreName: string;
  farmerName: string;
  weighedKg: string;
  rejectedKg: string;
  grade: string | null;
  status: string;
  deliveredAt: string;
}

export interface StorageView {
  id: string;
  facilityName: string;
  quantityKg: string;
  status: string;
  createdAt: string;
}

export async function listEligibleLogisticsCompanies(): Promise<CompanyOption[]> {
  const rows = await getDatabase().logisticsCompany.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
    take: 100,
    select: { id: true, name: true, companyCode: true },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, code: row.companyCode }));
}

export async function listCollectionCentres() {
  return getDatabase().agriculturalCollectionCentre.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      location: true,
      capacityKg: true,
      operator: { select: { user: { select: { name: true } } } },
    },
  });
}

export async function listStorageFacilities() {
  return getDatabase().agriculturalStorageFacility.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      location: true,
      capacityKg: true,
      coldChain: true,
      rateAmount: true,
      rateUnit: true,
      currency: true,
      supplier: { select: { businessName: true, verificationStatus: true } },
    },
  });
}

export async function listAgriculturalDeliveries(farmerId: string): Promise<DeliveryView[]> {
  const rows = await getDatabase().agriculturalDelivery.findMany({
    where: { farmerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      cargoType: true,
      direction: true,
      quantity: true,
      unit: true,
      createdAt: true,
      request: {
        select: {
          requestNumber: true,
          status: true,
          jobs: {
            orderBy: { assignedAt: "desc" },
            take: 1,
            select: {
              status: true,
              driverMembership: { select: { driver: { select: { fullName: true } } } },
            },
          },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.request.requestNumber,
    cargoType: row.cargoType,
    direction: row.direction,
    quantity: row.quantity.toString(),
    unit: row.unit,
    requestStatus: row.request.status,
    jobStatus: row.request.jobs[0]?.status ?? null,
    driverName: row.request.jobs[0]?.driverMembership?.driver.fullName ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listOperatorIntakes(farmerId: string): Promise<IntakeView[]> {
  return listIntakes({ centreOperatorFarmerId: farmerId });
}

export async function listIntakes(scope: {
  centreId?: string;
  farmerId?: string;
  centreOperatorFarmerId?: string;
}): Promise<IntakeView[]> {
  const rows = await getDatabase().agriculturalIntakeRecord.findMany({
    where: {
      ...(scope.centreId ? { centreId: scope.centreId } : {}),
      ...(scope.farmerId ? { farmerId: scope.farmerId } : {}),
      ...(scope.centreOperatorFarmerId
        ? { centre: { operatorFarmerId: scope.centreOperatorFarmerId } }
        : {}),
    },
    orderBy: { deliveredAt: "desc" },
    take: 100,
    select: {
      id: true,
      weighedKg: true,
      rejectedKg: true,
      grade: true,
      status: true,
      deliveredAt: true,
      centre: { select: { name: true } },
      farmer: { select: { user: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    centreName: row.centre.name,
    farmerName: row.farmer.user.name,
    weighedKg: row.weighedKg.toString(),
    rejectedKg: row.rejectedKg.toString(),
    grade: row.grade,
    status: row.status,
    deliveredAt: row.deliveredAt.toISOString(),
  }));
}

export async function listStorageBookings(scope: {
  facilitySupplierId?: string;
  farmerId?: string;
}): Promise<StorageView[]> {
  const rows = await getDatabase().agriculturalStorageBooking.findMany({
    where: {
      ...(scope.facilitySupplierId ? { facility: { supplierId: scope.facilitySupplierId } } : {}),
      ...(scope.farmerId ? { farmerId: scope.farmerId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      quantityKg: true,
      status: true,
      createdAt: true,
      facility: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    facilityName: row.facility.name,
    quantityKg: row.quantityKg.toString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
