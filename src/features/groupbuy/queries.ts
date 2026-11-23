import "server-only";

import type { GroupBuyStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface CampaignTierView {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: string;
}

export interface CampaignParticipationSummary {
  id: string;
  buyerId: string;
  buyerName: string;
  quantity: number;
  reservedPrice: string;
  status: string;
  createdAt: string;
}

export interface CampaignView {
  id: string;
  campaignNumber: string;
  vendorId: string;
  vendorName: string;
  productId: string | null;
  title: string;
  description: string;
  currency: string;
  basePrice: string;
  targetQuantity: number;
  maxQuantity: number | null;
  status: GroupBuyStatus;
  startsAt: string;
  endsAt: string;
  fundedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  tiers: CampaignTierView[];
  participations: CampaignParticipationSummary[];
}

export interface CampaignProgress {
  totalQuantity: number;
  currentTierPrice: string;
  progressPercentage: number;
  participantCount: number;
  isFunded: boolean;
}

export interface CampaignListItem {
  id: string;
  campaignNumber: string;
  vendorId: string;
  vendorName: string;
  title: string;
  currency: string;
  basePrice: string;
  targetQuantity: number;
  status: GroupBuyStatus;
  endsAt: string;
  totalQuantity: number;
  currentTierPrice: string;
  progressPercentage: number;
  participantCount: number;
}

export interface BuyerParticipationView {
  id: string;
  campaignId: string;
  campaignTitle: string;
  vendorName: string;
  quantity: number;
  currency: string;
  reservedPrice: string;
  status: string;
  campaignStatus: GroupBuyStatus;
  createdAt: string;
}

function toTierView(tier: {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: { toString(): string };
}): CampaignTierView {
  return {
    id: tier.id,
    minQuantity: tier.minQuantity,
    maxQuantity: tier.maxQuantity,
    unitPrice: tier.unitPrice.toString(),
  };
}

function toParticipationSummary(p: {
  id: string;
  buyerId: string;
  buyer: { name: string };
  quantity: number;
  reservedPrice: { toString(): string };
  status: string;
  createdAt: Date;
}): CampaignParticipationSummary {
  return {
    id: p.id,
    buyerId: p.buyerId,
    buyerName: p.buyer.name,
    quantity: p.quantity,
    reservedPrice: p.reservedPrice.toString(),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

function toCampaignView(row: {
  id: string;
  campaignNumber: string;
  vendorId: string;
  vendor: { name: string };
  productId: string | null;
  title: string;
  description: string;
  currency: string;
  basePrice: { toString(): string };
  targetQuantity: number;
  maxQuantity: number | null;
  status: GroupBuyStatus;
  startsAt: Date;
  endsAt: Date;
  fundedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  tiers: Array<{
    id: string;
    minQuantity: number;
    maxQuantity: number | null;
    unitPrice: { toString(): string };
  }>;
  participations: Array<{
    id: string;
    buyerId: string;
    buyer: { name: string };
    quantity: number;
    reservedPrice: { toString(): string };
    status: string;
    createdAt: Date;
  }>;
}): CampaignView {
  return {
    id: row.id,
    campaignNumber: row.campaignNumber,
    vendorId: row.vendorId,
    vendorName: row.vendor.name,
    productId: row.productId,
    title: row.title,
    description: row.description,
    currency: row.currency,
    basePrice: row.basePrice.toString(),
    targetQuantity: row.targetQuantity,
    maxQuantity: row.maxQuantity,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    fundedAt: row.fundedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    tiers: row.tiers.map(toTierView),
    participations: row.participations.map(toParticipationSummary),
  };
}

/**
 * Resolves the unit price for a cumulative quantity from campaign tiers.
 * Tiers are matched by [minQuantity, maxQuantity] inclusive; the base price
 * is used when no tier applies. Among overlapping tiers the highest minQuantity wins.
 */
export function resolveTierPriceForQuantity(
  quantity: number,
  basePrice: string,
  tiers: readonly CampaignTierView[],
): string {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a positive integer.");
  }

  const matching = tiers
    .filter(
      (tier) =>
        quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity),
    )
    .sort((a, b) => b.minQuantity - a.minQuantity);

  return matching[0]?.unitPrice ?? basePrice;
}

/**
 * Computes progress for a campaign: total quantity joined, current tier price,
 * progress percentage toward target, and participant count.
 */
export function getCampaignProgress(campaign: {
  targetQuantity: number;
  basePrice: string;
  tiers: readonly CampaignTierView[];
  participations: readonly { quantity: number }[];
  status: GroupBuyStatus;
}): CampaignProgress {
  const totalQuantity = campaign.participations.reduce((sum, p) => sum + p.quantity, 0);
  const currentTierPrice = resolveTierPriceForQuantity(
    Math.max(totalQuantity, 1),
    campaign.basePrice,
    campaign.tiers,
  );
  const progressPercentage = Math.min(
    100,
    Math.round((totalQuantity / campaign.targetQuantity) * 100),
  );
  const participantCount = campaign.participations.length;
  const isFunded = totalQuantity >= campaign.targetQuantity || campaign.status === "FUNDED";

  return {
    totalQuantity,
    currentTierPrice,
    progressPercentage,
    participantCount,
    isFunded,
  };
}

export async function listActiveCampaigns(): Promise<CampaignListItem[]> {
  const rows = await getDatabase().groupBuyCampaign.findMany({
    where: { status: "ACTIVE" },
    orderBy: { endsAt: "asc" },
    select: {
      id: true,
      campaignNumber: true,
      vendorId: true,
      vendor: { select: { name: true } },
      title: true,
      currency: true,
      basePrice: true,
      targetQuantity: true,
      status: true,
      endsAt: true,
      tiers: {
        orderBy: { minQuantity: "asc" },
        select: { id: true, minQuantity: true, maxQuantity: true, unitPrice: true },
      },
      participations: { select: { quantity: true } },
    },
  });

  return rows.map((row) => {
    const tiers = row.tiers.map(toTierView);
    const progress = getCampaignProgress({
      targetQuantity: row.targetQuantity,
      basePrice: row.basePrice.toString(),
      tiers,
      participations: row.participations,
      status: row.status,
    });

    return {
      id: row.id,
      campaignNumber: row.campaignNumber,
      vendorId: row.vendorId,
      vendorName: row.vendor.name,
      title: row.title,
      currency: row.currency,
      basePrice: row.basePrice.toString(),
      targetQuantity: row.targetQuantity,
      status: row.status,
      endsAt: row.endsAt.toISOString(),
      totalQuantity: progress.totalQuantity,
      currentTierPrice: progress.currentTierPrice,
      progressPercentage: progress.progressPercentage,
      participantCount: progress.participantCount,
    };
  });
}

export async function listVendorCampaigns(vendorId: string): Promise<CampaignListItem[]> {
  const rows = await getDatabase().groupBuyCampaign.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      campaignNumber: true,
      vendorId: true,
      vendor: { select: { name: true } },
      title: true,
      currency: true,
      basePrice: true,
      targetQuantity: true,
      status: true,
      endsAt: true,
      tiers: {
        orderBy: { minQuantity: "asc" },
        select: { id: true, minQuantity: true, maxQuantity: true, unitPrice: true },
      },
      participations: { select: { quantity: true } },
    },
  });

  return rows.map((row) => {
    const tiers = row.tiers.map(toTierView);
    const progress = getCampaignProgress({
      targetQuantity: row.targetQuantity,
      basePrice: row.basePrice.toString(),
      tiers,
      participations: row.participations,
      status: row.status,
    });

    return {
      id: row.id,
      campaignNumber: row.campaignNumber,
      vendorId: row.vendorId,
      vendorName: row.vendor.name,
      title: row.title,
      currency: row.currency,
      basePrice: row.basePrice.toString(),
      targetQuantity: row.targetQuantity,
      status: row.status,
      endsAt: row.endsAt.toISOString(),
      totalQuantity: progress.totalQuantity,
      currentTierPrice: progress.currentTierPrice,
      progressPercentage: progress.progressPercentage,
      participantCount: progress.participantCount,
    };
  });
}

export async function getCampaign(id: string): Promise<CampaignView | null> {
  const row = await getDatabase().groupBuyCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      campaignNumber: true,
      vendorId: true,
      vendor: { select: { name: true } },
      productId: true,
      title: true,
      description: true,
      currency: true,
      basePrice: true,
      targetQuantity: true,
      maxQuantity: true,
      status: true,
      startsAt: true,
      endsAt: true,
      fundedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      tiers: {
        orderBy: { minQuantity: "asc" },
        select: { id: true, minQuantity: true, maxQuantity: true, unitPrice: true },
      },
      participations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          buyerId: true,
          buyer: { select: { name: true } },
          quantity: true,
          reservedPrice: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  return row ? toCampaignView(row) : null;
}

export async function listBuyerParticipations(userId: string): Promise<BuyerParticipationView[]> {
  const rows = await getDatabase().groupBuyParticipation.findMany({
    where: { buyerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      campaignId: true,
      campaign: {
        select: {
          title: true,
          vendor: { select: { name: true } },
          status: true,
        },
      },
      quantity: true,
      currency: true,
      reservedPrice: true,
      status: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaign.title,
    vendorName: row.campaign.vendor.name,
    quantity: row.quantity,
    currency: row.currency,
    reservedPrice: row.reservedPrice.toString(),
    status: row.status,
    campaignStatus: row.campaign.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
