import "server-only";

import { getDatabase } from "@/server/db/client";

export interface CorridorSummary {
  id: string;
  corridorCode: string;
  name: string;
  description: string;
  originBranchId: string;
  originBranchName: string;
  destBranchId: string;
  destBranchName: string;
  currency: string;
  baseFee: string;
  perKmFee: string;
  estimatedKm: number;
  estimatedHours: number;
  status: string;
  stopCount: number;
}

export interface CorridorStopView {
  id: string;
  branchId: string;
  branchName: string;
  stopOrder: number;
  label: string;
}

export interface CorridorDetail extends CorridorSummary {
  stops: CorridorStopView[];
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchOption {
  id: string;
  businessId: string;
  name: string;
  branchCode: string;
  address: string | null;
  city: string | null;
  isPrimary: boolean;
}

export async function listActiveCorridors(): Promise<CorridorSummary[]> {
  const rows = await getDatabase().regionalCorridor.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      corridorCode: true,
      name: true,
      description: true,
      originBranchId: true,
      destBranchId: true,
      currency: true,
      baseFee: true,
      perKmFee: true,
      estimatedKm: true,
      estimatedHours: true,
      status: true,
      originBranch: { select: { name: true } },
      destBranch: { select: { name: true } },
      _count: { select: { stops: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    corridorCode: row.corridorCode,
    name: row.name,
    description: row.description,
    originBranchId: row.originBranchId,
    originBranchName: row.originBranch.name,
    destBranchId: row.destBranchId,
    destBranchName: row.destBranch.name,
    currency: row.currency,
    baseFee: row.baseFee.toString(),
    perKmFee: row.perKmFee.toString(),
    estimatedKm: row.estimatedKm,
    estimatedHours: row.estimatedHours,
    status: row.status,
    stopCount: row._count.stops,
  }));
}

export async function listAllCorridors(): Promise<CorridorSummary[]> {
  const rows = await getDatabase().regionalCorridor.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      corridorCode: true,
      name: true,
      description: true,
      originBranchId: true,
      destBranchId: true,
      currency: true,
      baseFee: true,
      perKmFee: true,
      estimatedKm: true,
      estimatedHours: true,
      status: true,
      originBranch: { select: { name: true } },
      destBranch: { select: { name: true } },
      _count: { select: { stops: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    corridorCode: row.corridorCode,
    name: row.name,
    description: row.description,
    originBranchId: row.originBranchId,
    originBranchName: row.originBranch.name,
    destBranchId: row.destBranchId,
    destBranchName: row.destBranch.name,
    currency: row.currency,
    baseFee: row.baseFee.toString(),
    perKmFee: row.perKmFee.toString(),
    estimatedKm: row.estimatedKm,
    estimatedHours: row.estimatedHours,
    status: row.status,
    stopCount: row._count.stops,
  }));
}

export async function getCorridor(id: string): Promise<CorridorDetail | null> {
  const row = await getDatabase().regionalCorridor.findUnique({
    where: { id },
    select: {
      id: true,
      corridorCode: true,
      name: true,
      description: true,
      originBranchId: true,
      destBranchId: true,
      currency: true,
      baseFee: true,
      perKmFee: true,
      estimatedKm: true,
      estimatedHours: true,
      status: true,
      activatedAt: true,
      createdAt: true,
      updatedAt: true,
      originBranch: { select: { name: true } },
      destBranch: { select: { name: true } },
      stops: {
        orderBy: { stopOrder: "asc" },
        select: {
          id: true,
          branchId: true,
          stopOrder: true,
          label: true,
          branch: { select: { name: true } },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    corridorCode: row.corridorCode,
    name: row.name,
    description: row.description,
    originBranchId: row.originBranchId,
    originBranchName: row.originBranch.name,
    destBranchId: row.destBranchId,
    destBranchName: row.destBranch.name,
    currency: row.currency,
    baseFee: row.baseFee.toString(),
    perKmFee: row.perKmFee.toString(),
    estimatedKm: row.estimatedKm,
    estimatedHours: row.estimatedHours,
    status: row.status,
    stopCount: row.stops.length,
    stops: row.stops.map((stop) => ({
      id: stop.id,
      branchId: stop.branchId,
      branchName: stop.branch.name,
      stopOrder: stop.stopOrder,
      label: stop.label,
    })),
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listBusinessBranches(businessId?: string): Promise<BranchOption[]> {
  const rows = await getDatabase().businessBranch.findMany({
    where: businessId ? { businessId } : undefined,
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: {
      id: true,
      businessId: true,
      name: true,
      branchCode: true,
      address: true,
      city: true,
      isPrimary: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    branchCode: row.branchCode,
    address: row.address,
    city: row.city,
    isPrimary: row.isPrimary,
  }));
}
