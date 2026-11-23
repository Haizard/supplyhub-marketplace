import "server-only";

import type { DisputeStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface DisputeView {
  id: string;
  disputeNumber: string;
  orderId: string;
  orderNumber: string;
  vendorOrderId: string;
  buyerId: string;
  buyerName: string;
  vendorId: string;
  vendorName: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeMessageView {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

type DisputeRow = {
  id: string;
  disputeNumber: string;
  orderId: string;
  vendorOrderId: string;
  buyerId: string;
  vendorId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function decorate(rows: DisputeRow[]): Promise<DisputeView[]> {
  if (rows.length === 0) return [];
  const database = getDatabase();
  const [orders, buyers, vendors] = await Promise.all([
    database.order.findMany({
      where: { id: { in: rows.map((r) => r.orderId) } },
      select: { id: true, orderNumber: true },
    }),
    database.user.findMany({
      where: { id: { in: rows.map((r) => r.buyerId) } },
      select: { id: true, name: true },
    }),
    database.vendor.findMany({
      where: { id: { in: rows.map((r) => r.vendorId) } },
      select: { id: true, name: true },
    }),
  ]);
  const orderNumbers = new Map(orders.map((o) => [o.id, o.orderNumber]));
  const buyerNames = new Map(buyers.map((u) => [u.id, u.name]));
  const vendorNames = new Map(vendors.map((v) => [v.id, v.name]));

  return rows.map((row) => ({
    id: row.id,
    disputeNumber: row.disputeNumber,
    orderId: row.orderId,
    orderNumber: orderNumbers.get(row.orderId) ?? row.orderId,
    vendorOrderId: row.vendorOrderId,
    buyerId: row.buyerId,
    buyerName: buyerNames.get(row.buyerId) ?? "Buyer",
    vendorId: row.vendorId,
    vendorName: vendorNames.get(row.vendorId) ?? "Studio",
    reason: row.reason,
    description: row.description,
    status: row.status,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

const disputeOrderBy = [{ createdAt: "desc" as const }];

export async function listBuyerDisputes(buyerId: string): Promise<DisputeView[]> {
  const rows = await getDatabase().dispute.findMany({
    where: { buyerId },
    orderBy: disputeOrderBy,
  });
  return decorate(rows);
}

export async function listAllDisputes(): Promise<DisputeView[]> {
  const rows = await getDatabase().dispute.findMany({ orderBy: disputeOrderBy });
  return decorate(rows);
}

export async function getDispute(id: string): Promise<DisputeView | null> {
  const row = await getDatabase().dispute.findUnique({ where: { id } });
  if (!row) return null;
  const [view] = await decorate([row]);
  return view ?? null;
}

export interface DisputableOrder {
  orderId: string;
  vendorOrderId: string;
  orderNumber: string;
  vendorName: string;
  status: string;
}

/** Vendor order lines belonging to the customer that can be disputed. */
export async function listDisputableOrders(customerId: string): Promise<DisputableOrder[]> {
  const database = getDatabase();
  const orders = await database.order.findMany({
    where: {
      customerId,
      status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      vendorOrders: {
        select: { id: true, vendorId: true },
      },
    },
  });
  const vendorIds = orders.flatMap((order) => order.vendorOrders.map((line) => line.vendorId));
  const vendors = await database.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const names = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));

  return orders.flatMap((order) =>
    order.vendorOrders.map((line) => ({
      orderId: order.id,
      vendorOrderId: line.id,
      orderNumber: order.orderNumber,
      vendorName: names.get(line.vendorId) ?? "Studio",
      status: order.status,
    })),
  );
}

export async function listDisputeMessages(disputeId: string): Promise<DisputeMessageView[]> {
  const database = getDatabase();
  const rows = await database.disputeMessage.findMany({
    where: { disputeId },
    orderBy: { createdAt: "asc" },
  });
  const senders = await database.user.findMany({
    where: { id: { in: rows.map((r) => r.senderId) } },
    select: { id: true, name: true },
  });
  const names = new Map(senders.map((u) => [u.id, u.name]));
  return rows.map((row) => ({
    id: row.id,
    senderId: row.senderId,
    senderName: names.get(row.senderId) ?? "Participant",
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }));
}
