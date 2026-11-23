import "server-only";

import type { CustomerSegment } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

import type { StudioCustomerView } from "./types";

const PAID_ORDER_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

/** Studio CRM rows: one buyer per studio, with aggregates derived from real orders. */
export async function listStudioCustomers(vendorId: string): Promise<StudioCustomerView[]> {
  const database = getDatabase();
  const [records, orders] = await Promise.all([
    database.customer.findMany({
      where: { vendorId },
      select: {
        id: true,
        userId: true,
        segment: true,
        note: true,
        user: { select: { name: true, email: true } },
      },
    }),
    database.vendorOrder.findMany({
      where: { vendorId },
      select: {
        status: true,
        subtotal: true,
        createdAt: true,
        order: {
          select: {
            customerId: true,
            placedAt: true,
            customer: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ]);

  const byUser = new Map<string, StudioCustomerView>();

  for (const record of records) {
    byUser.set(record.userId, {
      userId: record.userId,
      recordId: record.id,
      name: record.user.name,
      email: record.user.email,
      segment: record.segment,
      note: record.note ?? "",
      orderCount: 0,
      paidOrderCount: 0,
      totalSpend: 0,
      lastOrderAt: null,
    });
  }

  for (const vendorOrder of orders) {
    const customerId = vendorOrder.order.customerId;
    let customer = byUser.get(customerId);

    if (!customer) {
      customer = {
        userId: customerId,
        recordId: null,
        name: vendorOrder.order.customer.name,
        email: vendorOrder.order.customer.email,
        segment: "NEW",
        note: "",
        orderCount: 0,
        paidOrderCount: 0,
        totalSpend: 0,
        lastOrderAt: null,
      };
      byUser.set(customerId, customer);
    }

    customer.orderCount += 1;
    if (PAID_ORDER_STATUSES.has(vendorOrder.status)) {
      customer.paidOrderCount += 1;
      customer.totalSpend += Number(vendorOrder.subtotal);
    }

    const orderAt = vendorOrder.order.placedAt.toISOString();
    if (!customer.lastOrderAt || orderAt > customer.lastOrderAt) {
      customer.lastOrderAt = orderAt;
    }
  }

  const customers = [...byUser.values()].map((customer) => ({
    ...customer,
    segment: (customer.recordId
      ? customer.segment
      : customer.paidOrderCount >= 4
        ? "VIP"
        : customer.paidOrderCount > 1
          ? "RETURNING"
          : "NEW") as CustomerSegment,
    totalSpend: Math.round(customer.totalSpend * 100) / 100,
  }));

  return customers.sort((a, b) => {
    const byRecency = (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? "");
    return byRecency || a.name.localeCompare(b.name);
  });
}
