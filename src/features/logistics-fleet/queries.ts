import "server-only";

import type { VehicleStatus, VerificationState } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface FleetView {
  id: string;
  name: string;
  branchId: string | null;
  vehicleCount: number;
}

export interface VehicleView {
  id: string;
  fleetId: string | null;
  plate: string;
  type: string;
  make: string;
  model: string;
  capacityKg: string | null;
  ownership: string;
  status: VehicleStatus;
  insuranceExpiresAt: string | null;
  inspectionExpiresAt: string | null;
  documentCount: number;
}

export interface VehicleDocumentView {
  id: string;
  vehicleId: string;
  type: string;
  reference: string;
  storageKey: string;
  expiresAt: string | null;
  status: VerificationState;
}

export interface MaintenanceView {
  id: string;
  vehicleId: string;
  performedAt: string;
  cost: string;
  currency: string;
  description: string;
}

export async function listFleets(companyId: string): Promise<FleetView[]> {
  const rows = await getDatabase().logisticsFleet.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, branchId: true, _count: { select: { vehicles: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    branchId: row.branchId,
    vehicleCount: row._count.vehicles,
  }));
}

export async function listVehicles(companyId: string): Promise<VehicleView[]> {
  const rows = await getDatabase().logisticsVehicle.findMany({
    where: { companyId },
    orderBy: [{ plate: "asc" }],
    select: {
      id: true,
      fleetId: true,
      plate: true,
      type: true,
      make: true,
      model: true,
      capacityKg: true,
      ownership: true,
      status: true,
      insuranceExpiresAt: true,
      inspectionExpiresAt: true,
      _count: { select: { documents: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    fleetId: row.fleetId,
    plate: row.plate,
    type: row.type,
    make: row.make ?? "",
    model: row.model ?? "",
    capacityKg: row.capacityKg?.toString() ?? null,
    ownership: row.ownership,
    status: row.status,
    insuranceExpiresAt: row.insuranceExpiresAt?.toISOString() ?? null,
    inspectionExpiresAt: row.inspectionExpiresAt?.toISOString() ?? null,
    documentCount: row._count.documents,
  }));
}

export async function listVehicleDocuments(companyId: string): Promise<VehicleDocumentView[]> {
  const rows = await getDatabase().vehicleDocument.findMany({
    where: { vehicle: { companyId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      vehicleId: true,
      type: true,
      reference: true,
      storageKey: true,
      expiresAt: true,
      status: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    vehicleId: row.vehicleId,
    type: row.type,
    reference: row.reference ?? "",
    storageKey: row.storageKey,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    status: row.status,
  }));
}

export async function listMaintenance(companyId: string): Promise<MaintenanceView[]> {
  const rows = await getDatabase().vehicleMaintenance.findMany({
    where: { vehicle: { companyId } },
    orderBy: { performedAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    vehicleId: row.vehicleId,
    performedAt: row.performedAt.toISOString(),
    cost: row.cost.toString(),
    currency: row.currency,
    description: row.description,
  }));
}
