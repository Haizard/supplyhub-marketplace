import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/server/audit/audit-log";

/** Creates the studio's CRM record the first time a buyer orders from them. */
export async function ensureCustomerRecord(
  client: Prisma.TransactionClient,
  vendorId: string,
  userId: string,
): Promise<void> {
  const existing = await client.customer.findUnique({
    where: { vendorId_userId: { vendorId, userId } },
    select: { id: true },
  });
  if (existing) return;

  const created = await client.customer.create({
    data: { vendorId, userId },
    select: { id: true },
  });

  await recordAuditEvent(client, {
    actorId: userId,
    action: "CUSTOMER_CREATED",
    targetType: "customer",
    targetId: created.id,
    metadata: { vendorId },
  });
}
