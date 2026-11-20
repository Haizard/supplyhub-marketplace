import "server-only";

import { getDatabase } from "@/server/db/client";

export interface ShipmentView {
  id: string;
  vendorOrderId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  shippedAt: Date;
  deliveredAt: Date | null;
  note: string | null;
}

/**
 * Shipments for one buyer order. Scoped by customer so a guessed order id
 * cannot expose another buyer's tracking details.
 */
export async function listCustomerShipments(
  orderId: string,
  customerId: string,
): Promise<ShipmentView[]> {
  const rows = await getDatabase().shipment.findMany({
    where: { vendorOrder: { orderId, order: { customerId } } },
    orderBy: { shippedAt: "asc" },
    select: {
      id: true,
      vendorOrderId: true,
      carrier: true,
      trackingNumber: true,
      trackingUrl: true,
      shippedAt: true,
      deliveredAt: true,
      note: true,
    },
  });

  return rows;
}
