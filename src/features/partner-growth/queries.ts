import "server-only";

import type { ReferralStatus, RewardStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface ReferralView {
  id: string;
  code: string;
  label: string;
  status: ReferralStatus;
  linkPath: string;
  clientName: string | null;
  clientVerified: boolean;
  completedDeliveries: number;
  registeredAt: string | null;
  verifiedAt: string | null;
  qualifiedAt: string | null;
  createdAt: string;
}

export interface RewardView {
  id: string;
  kind: string;
  status: RewardStatus;
  points: number;
  amount: string | null;
  referralCode: string;
  clientName: string | null;
  createdAt: string;
}

export async function listCompanyReferrals(companyId: string): Promise<ReferralView[]> {
  const rows = await getDatabase().partnerReferral.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      client: {
        select: {
          name: true,
          verifiedAt: true,
          relationships: {
            where: { companyId },
            select: { status: true },
          },
          contracts: {
            where: { companyId },
            select: {
              deliveries: { where: { status: "COMPLETED" }, select: { id: true } },
            },
          },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    status: row.status,
    linkPath: row.linkPath,
    clientName: row.client?.name ?? null,
    clientVerified: Boolean(row.client?.verifiedAt),
    completedDeliveries:
      row.client?.contracts.reduce((sum, contract) => sum + contract.deliveries.length, 0) ?? 0,
    registeredAt: row.registeredAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    qualifiedAt: row.qualifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listCompanyRewards(companyId: string): Promise<RewardView[]> {
  const rows = await getDatabase().partnerReward.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      referral: { select: { code: true, client: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    points: row.points,
    amount: row.amount?.toString() ?? null,
    referralCode: row.referral.code,
    clientName: row.referral.client?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listClientsForReferral(companyId: string) {
  const relationships = await getDatabase().companyClientRelationship.findMany({
    where: { companyId },
    select: { client: { select: { id: true, name: true, verifiedAt: true } } },
  });
  return relationships.map((relationship) => ({
    id: relationship.client.id,
    name: relationship.client.name,
    verified: Boolean(relationship.client.verifiedAt),
  }));
}
