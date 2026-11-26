import "server-only";

import { listBusinessesForUser } from "@/features/business/queries";
import { decimalToCents } from "@/features/catalog/money";
import { getStudioProductStats } from "@/features/catalog/vendor-queries";
import { listConversations } from "@/features/messaging/queries";
import { listWishlistProducts } from "@/features/wishlist/queries";
import type { Actor } from "@/server/auth/actor";
import { studioIdentityFor } from "@/server/business/active-business";
import { getDatabase } from "@/server/db/client";

const SETTLED_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const OPEN_VENDOR_ORDER_STATUSES = ["PAID", "PROCESSING"] as const;
const OPEN_BUYER_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED"] as const;
const ACTIVE_JOB_STATUSES = ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] as const;

const DEFAULT_CURRENCY = "TZS";
const UPCOMING_PAYMENT_WINDOW_DAYS = 7;

export interface SellerSnapshot {
  vendorId: string;
  currency: string;
  salesTodayCents: number;
  ordersToPrepare: number;
  paymentsDue: number;
  lowStock: number;
  publishedProducts: number;
  unreadMessages: number;
}

export interface BuyerSnapshot {
  openOrders: number;
  savedProducts: number;
  unreadMessages: number;
}

export interface CourierSnapshot {
  activeDeliveries: number;
  completedTrips: number;
  presence: string;
}

export interface FarmerSnapshot {
  farmerId: string;
  verificationStatus: string;
  region: string | null;
  activeCrops: number;
  pendingAgreements: number;
  activeGroups: number;
}

export interface LogisticsSnapshot {
  companyId: string;
  companyName: string;
  activeJobs: number;
  activeMembers: number;
  openOpportunities: number;
}

export interface WorkspaceSnapshot {
  businesses: Array<{ id: string; name: string }>;
  business: { id: string; name: string } | null;
  seller: SellerSnapshot | null;
  farmer: FarmerSnapshot | null;
  logistics: LogisticsSnapshot | null;
  buyer: BuyerSnapshot;
  courier: CourierSnapshot | null;
}

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function unreadTotal(conversations: ReadonlyArray<{ unread: number }>): number {
  return conversations.reduce((total, conversation) => total + conversation.unread, 0);
}

/**
 * One request-scoped read that feeds the task-first home. Every number comes
 * from the database for the signed-in actor; the interface never derives money
 * or status from client input.
 */
export async function getWorkspaceSnapshot(actor: Actor): Promise<WorkspaceSnapshot> {
  const database = getDatabase();
  const studio = studioIdentityFor({
    business: actor.business ?? null,
    vendor: actor.vendor,
  });

  const [memberships, agent, farmer, logisticsMember] = await Promise.all([
    listBusinessesForUser(actor.id),
    database.deliveryAgent.findFirst({
      where: { userId: actor.id },
      select: { id: true, presence: true, completedTrips: true },
    }),
    database.agricultureFarmer.findUnique({
      where: { userId: actor.id },
      select: { id: true, verificationStatus: true, region: true },
    }),
    database.logisticsCompanyMember.findFirst({
      where: { userId: actor.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { companyId: true, company: { select: { name: true } } },
    }),
  ]);

  const [
    seller,
    buyerOrders,
    savedProducts,
    buyerConversations,
    activeDeliveries,
    farmerSnapshot,
    logisticsSnapshot,
  ] = await Promise.all([
    studio
      ? loadSellerSnapshot(actor, studio.vendorId, studio.businessId)
      : Promise.resolve<SellerSnapshot | null>(null),
    database.order.count({
      where: { customerId: actor.id, status: { in: [...OPEN_BUYER_ORDER_STATUSES] } },
    }),
    listWishlistProducts(actor.id),
    listConversations({ side: "buyer", viewerId: actor.id }, 50),
    agent
      ? database.deliveryJob.count({
          where: { agentId: agent.id, status: { in: [...ACTIVE_JOB_STATUSES] } },
        })
      : Promise.resolve(0),
    farmer
      ? loadFarmerSnapshot(farmer.id, farmer.verificationStatus, farmer.region)
      : Promise.resolve<FarmerSnapshot | null>(null),
    logisticsMember
      ? loadLogisticsSnapshot(logisticsMember.companyId, logisticsMember.company.name)
      : Promise.resolve<LogisticsSnapshot | null>(null),
  ]);

  return {
    businesses: memberships.map((membership) => ({
      id: membership.business.id,
      name: membership.business.name,
    })),
    business: actor.business ? { id: actor.business.id, name: actor.business.name } : null,
    seller,
    farmer: farmerSnapshot,
    logistics: logisticsSnapshot,
    buyer: {
      openOrders: buyerOrders,
      savedProducts: savedProducts.length,
      unreadMessages: unreadTotal(buyerConversations),
    },
    courier: agent
      ? {
          activeDeliveries,
          completedTrips: agent.completedTrips,
          presence: agent.presence,
        }
      : null,
  };
}

async function loadFarmerSnapshot(
  farmerId: string,
  verificationStatus: string,
  region: string | null,
): Promise<FarmerSnapshot> {
  const database = getDatabase();

  const [activeCrops, pendingAgreements, activeGroups] = await Promise.all([
    database.farmCrop.count({ where: { farmerId, status: { in: ["PLANTED", "GROWING"] } } }),
    database.harvestPurchaseAgreement.count({
      where: { farmerId, status: "PENDING_FARMER" },
    }),
    database.farmerGroupMember.count({ where: { farmerId, status: "ACTIVE" } }),
  ]);

  return { farmerId, verificationStatus, region, activeCrops, pendingAgreements, activeGroups };
}

async function loadLogisticsSnapshot(
  companyId: string,
  companyName: string,
): Promise<LogisticsSnapshot> {
  const database = getDatabase();

  const [activeJobs, activeMembers, openOpportunities] = await Promise.all([
    database.deliveryJob.count({
      where: { status: { in: [...ACTIVE_JOB_STATUSES] }, request: { companyId } },
    }),
    database.logisticsCompanyMember.count({ where: { companyId, status: "ACTIVE" } }),
    database.deliveryOpportunity.count({ where: { offeredToId: companyId, status: "OPEN" } }),
  ]);

  return { companyId, companyName, activeJobs, activeMembers, openOpportunities };
}

async function loadSellerSnapshot(
  actor: Actor,
  vendorId: string,
  businessId: string | null,
): Promise<SellerSnapshot> {
  const database = getDatabase();
  const dueBefore = new Date(Date.now() + UPCOMING_PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [sales, ordersToPrepare, stats, conversations, paymentsDue] = await Promise.all([
    database.vendorOrder.aggregate({
      where: {
        vendorId,
        status: { in: [...SETTLED_ORDER_STATUSES] },
        createdAt: { gte: startOfToday() },
      },
      _sum: { subtotal: true },
    }),
    database.vendorOrder.count({
      where: { vendorId, status: { in: [...OPEN_VENDOR_ORDER_STATUSES] } },
    }),
    getStudioProductStats(vendorId),
    listConversations({ side: "studio", viewerId: actor.id, vendorId }, 50),
    businessId
      ? database.installmentSchedule.count({
          where: {
            status: { in: ["PENDING", "OVERDUE"] },
            dueDate: { lte: dueBefore },
            agreement: { businessId, status: { in: ["ACTIVE", "OVERDUE"] } },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    vendorId,
    currency: DEFAULT_CURRENCY,
    salesTodayCents: sales._sum.subtotal ? decimalToCents(sales._sum.subtotal) : 0,
    ordersToPrepare,
    paymentsDue,
    lowStock: stats.lowStock,
    publishedProducts: stats.published,
    unreadMessages: unreadTotal(conversations),
  };
}
