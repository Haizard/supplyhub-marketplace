"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";

const customerUpdateSchema = z.object({
  customerId: z.uuid(),
  note: z.string().trim().max(1000, "Keep notes under 1000 characters."),
  segment: z.enum(["NEW", "RETURNING", "VIP"]),
});

export type SaveCustomerResult = { ok: true } | { ok: false; error: string };

export async function saveCustomerAction(input: {
  customerId: string;
  note: string;
  segment: string;
}): Promise<SaveCustomerResult> {
  const access = await requireStudioAccess("crm.manage", "/vendor/customers");
  const parsed = customerUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid customer update." };
  }

  const database = getDatabase();
  const customer = await database.customer.findFirst({
    where: { id: parsed.data.customerId, vendorId: access.vendorId },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "That customer record could not be found." };

  await database.$transaction(async (transaction) => {
    await transaction.customer.update({
      where: { id: customer.id },
      data: { note: parsed.data.note || null, segment: parsed.data.segment },
    });

    await recordAuditEvent(transaction, {
      actorId: access.actor.id,
      action: "CUSTOMER_UPDATED",
      targetType: "customer",
      targetId: customer.id,
      metadata: { segment: parsed.data.segment },
    });
  });

  revalidatePath("/vendor/customers");
  return { ok: true };
}
