import "server-only";

import type { ReturnReason, ReturnStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

/** Order states in which a buyer may ask the studio to take something back. */
export const RETURNABLE_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export interface ReturnableItem {
  orderItemId: string;
  productName: string;
  sku: string;
  quantity: number;
  quantityAlreadyReturned: number;
  returnableQuantity: number;
}

export interface ReturnableVendorOrder {
  vendorOrderId: string;
  vendorName: string;
  status: ReturnStatus | null;
  items: ReturnableItem[];
}

export interface CustomerReturnView {
  id: string;
  vendorOrderId: string;
  returnNumber: string;
  status: ReturnStatus;
  vendorName: string;
  note: string | null;
  vendorNote: string | null;
  requestedAt: Date;
  items: {
    id: string;
    productName: string;
    quantity: number;
    reason: ReturnReason;
  }[];
}

export interface VendorReturnView extends CustomerReturnView {
  orderNumber: string;
  customerName: string;
}

export async function getReturnableVendorOrders(
  orderId: string,
  customerId: string,
): Promise<ReturnableVendorOrder[]> {
  const database = getDatabase();
  const order = await database.order.findFirst({
    where: {
      id: orderId,
      customerId,
      status: { in: [...RETURNABLE_ORDER_STATUSES] },
    },
    select: {
      vendorOrders: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          vendor: { select: { name: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              productName: true,
              sku: true,
              quantity: true,
              returnItem: { select: { return: { select: { status: true } } } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return [];
  }

  return order.vendorOrders.map((vendorOrder) => {
    const activeReturn = vendorOrder.items.find(
      (item) =>
        item.returnItem &&
        item.returnItem.return.status !== "REJECTED" &&
        item.returnItem.return.status !== "COMPLETED",
    );

    return {
      vendorOrderId: vendorOrder.id,
      vendorName: vendorOrder.vendor.name,
      status: activeReturn?.returnItem?.return.status ?? null,
      items: vendorOrder.items
        .filter((item) => !item.returnItem)
        .map((item) => ({
          orderItemId: item.id,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          quantityAlreadyReturned: 0,
          returnableQuantity: item.returnItem ? 0 : item.quantity,
        }))
        .filter((item) => item.returnableQuantity > 0),
    };
  });
}

export async function listCustomerReturns(
  orderId: string,
  customerId: string,
): Promise<CustomerReturnView[]> {
  const database = getDatabase();
  const rows = await database.returnRequest.findMany({
    where: { orderId, customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      vendorOrderId: true,
      returnNumber: true,
      status: true,
      note: true,
      vendorNote: true,
      requestedAt: true,
      vendorOrder: { select: { vendor: { select: { name: true } } } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          reason: true,
          orderItem: { select: { productName: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    vendorOrderId: row.vendorOrderId,
    returnNumber: row.returnNumber,
    status: row.status,
    vendorName: row.vendorOrder.vendor.name,
    note: row.note,
    vendorNote: row.vendorNote,
    requestedAt: row.requestedAt,
    items: row.items.map((item) => ({
      id: item.id,
      productName: item.orderItem.productName,
      quantity: item.quantity,
      reason: item.reason,
    })),
  }));
}

export async function listVendorReturns(vendorId: string): Promise<VendorReturnView[]> {
  const database = getDatabase();
  const rows = await database.returnRequest.findMany({
    where: { vendorOrder: { vendorId } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      vendorOrderId: true,
      returnNumber: true,
      status: true,
      note: true,
      vendorNote: true,
      requestedAt: true,
      order: { select: { orderNumber: true, customer: { select: { name: true } } } },
      vendorOrder: { select: { vendor: { select: { name: true } } } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          reason: true,
          orderItem: { select: { productName: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    vendorOrderId: row.vendorOrderId,
    returnNumber: row.returnNumber,
    status: row.status,
    note: row.note,
    vendorNote: row.vendorNote,
    requestedAt: row.requestedAt,
    orderNumber: row.order.orderNumber,
    customerName: row.order.customer.name,
    vendorName: row.vendorOrder.vendor.name,
    items: row.items.map((item) => ({
      id: item.id,
      productName: item.orderItem.productName,
      quantity: item.quantity,
      reason: item.reason,
    })),
  }));
}
