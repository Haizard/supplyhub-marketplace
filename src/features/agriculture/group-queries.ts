import "server-only";

import { getDatabase } from "@/server/db/client";

export interface GroupView {
  id: string;
  groupCode: string;
  name: string;
  coordinatorName: string;
  memberCount: number;
  isActive: boolean;
}

export interface HarvestAgreementView {
  id: string;
  agreementNumber: string;
  cropName: string;
  expectedQuantity: string;
  unit: string;
  currency: string;
  status: string;
  paymentStatus: string | null;
  deliveredQuantity: string | null;
  varianceKg: string | null;
  groupName: string | null;
  createdAt: string;
}

export async function listFarmerGroups(farmerId: string): Promise<GroupView[]> {
  const rows = await getDatabase().farmerGroup.findMany({
    where: {
      OR: [{ coordinatorId: farmerId }, { members: { some: { farmerId, status: "ACTIVE" } } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      groupCode: true,
      name: true,
      isActive: true,
      coordinator: { select: { user: { select: { name: true } } } },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    groupCode: row.groupCode,
    name: row.name,
    coordinatorName: row.coordinator.user.name,
    memberCount: row._count.members,
    isActive: row.isActive,
  }));
}

export async function listAllFarmers(): Promise<{ id: string; name: string }[]> {
  const rows = await getDatabase().agricultureFarmer.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, user: { select: { name: true } } },
  });
  return rows.map((row) => ({ id: row.id, name: row.user.name }));
}

export async function listHarvestAgreements(scope: {
  buyerUserId?: string;
  farmerId?: string;
  groupId?: string;
}): Promise<HarvestAgreementView[]> {
  const rows = await getDatabase().harvestPurchaseAgreement.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      agreementNumber: true,
      cropName: true,
      expectedQuantity: true,
      unit: true,
      currency: true,
      status: true,
      createdAt: true,
      group: { select: { name: true } },
      order: { select: { payments: { select: { status: true }, take: 1 } } },
      deliveries: {
        orderBy: { deliveredAt: "desc" },
        take: 1,
        select: { deliveredQuantity: true, varianceKg: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    agreementNumber: row.agreementNumber,
    cropName: row.cropName,
    expectedQuantity: row.expectedQuantity.toString(),
    unit: row.unit,
    currency: row.currency,
    status: row.status,
    paymentStatus: row.order?.payments[0]?.status ?? null,
    deliveredQuantity: row.deliveries[0]?.deliveredQuantity.toString() ?? null,
    varianceKg: row.deliveries[0]?.varianceKg.toString() ?? null,
    groupName: row.group?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
