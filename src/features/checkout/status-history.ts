import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * Appends one status change. Call it inside the transaction that changed the
 * status, so the timeline can never disagree with the order record.
 */
export async function recordOrderStatusChange(
  transaction: Prisma.TransactionClient,
  input: {
    orderId: string;
    vendorOrderId?: string | null;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    actorId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await transaction.orderStatusHistory.create({
    data: {
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId ?? null,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
    },
  });
}
