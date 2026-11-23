"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor, requireAdmin, requireCustomer } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { canTransitionDispute, isDisputeClosed } from "./status";
import { disputeMessageSchema, disputeStatusSchema, openDisputeSchema } from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

export async function openDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireCustomer("/account/disputes");
  const parsed = openDisputeSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    vendorOrderId: formValue(formData, "vendorOrderId"),
    reason: formValue(formData, "reason"),
    description: formValue(formData, "description"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: parsed.data.orderId, customerId: actor.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        vendorOrders: {
          where: { id: parsed.data.vendorOrderId },
          select: { id: true, vendorId: true },
        },
      },
    });
    if (!order) return "not-found" as const;
    if (
      order.status === "AWAITING_PAYMENT" ||
      order.status === "CANCELLED" ||
      order.status === "EXPIRED"
    ) {
      return "not-eligible" as const;
    }
    const vendorOrder = order.vendorOrders[0];
    if (!vendorOrder) return "not-found" as const;

    const existing = await tx.dispute.findFirst({
      where: {
        orderId: order.id,
        vendorOrderId: vendorOrder.id,
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
      select: { id: true },
    });
    if (existing) return "already-open" as const;

    const created = await tx.dispute.create({
      data: {
        disputeNumber: makeDocumentNumber("DS"),
        orderId: order.id,
        vendorOrderId: vendorOrder.id,
        buyerId: actor.id,
        vendorId: vendorOrder.vendorId,
        reason: parsed.data.reason,
        description: parsed.data.description,
        status: "OPEN",
      },
      select: { id: true, disputeNumber: true },
    });

    await tx.disputeMessage.create({
      data: {
        disputeId: created.id,
        senderId: actor.id,
        body: parsed.data.description,
      },
    });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "DISPUTE_OPENED",
      targetType: "Dispute",
      targetId: created.id,
      metadata: { disputeNumber: created.disputeNumber, orderNumber: order.orderNumber },
    });

    await appendOutboxEvent(tx, {
      eventType: "dispute.opened",
      aggregateType: "Dispute",
      aggregateId: created.id,
      payload: {
        disputeNumber: created.disputeNumber,
        orderId: order.id,
        vendorId: vendorOrder.vendorId,
      },
    });

    return "ok" as const;
  });

  revalidatePath("/account/disputes");
  revalidatePath("/admin/disputes");
  if (result === "not-found") return fail("That order line could not be found.");
  if (result === "not-eligible") return fail("This order is not eligible for a dispute.");
  if (result === "already-open") return fail("An open dispute already exists for this order.");
  return ok("Dispute opened.");
}

export async function addDisputeMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireActor("/account/disputes");
  const parsed = disputeMessageSchema.safeParse({
    disputeId: formValue(formData, "disputeId"),
    body: formValue(formData, "body"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { id: parsed.data.disputeId },
      select: { id: true, buyerId: true, status: true, disputeNumber: true },
    });
    if (!dispute) return "not-found" as const;
    const isAdmin = actor.role === "ADMIN";
    if (!isAdmin && dispute.buyerId !== actor.id) return "denied" as const;
    if (isDisputeClosed(dispute.status)) return "closed" as const;

    await tx.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: actor.id,
        body: parsed.data.body,
      },
    });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "DISPUTE_MESSAGE_ADDED",
      targetType: "Dispute",
      targetId: dispute.id,
      metadata: { disputeNumber: dispute.disputeNumber },
    });

    await appendOutboxEvent(tx, {
      eventType: "dispute.message_added",
      aggregateType: "Dispute",
      aggregateId: dispute.id,
      payload: { disputeNumber: dispute.disputeNumber, senderId: actor.id },
    });

    return "ok" as const;
  });

  revalidatePath(`/account/disputes/${parsed.data.disputeId}`);
  revalidatePath(`/admin/disputes/${parsed.data.disputeId}`);
  if (result === "not-found") return fail("That dispute could not be found.");
  if (result === "denied") return fail("You cannot post to this dispute.");
  if (result === "closed") return fail("This dispute is closed.");
  return ok("Message added.");
}

export async function updateDisputeStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = disputeStatusSchema.safeParse({
    disputeId: formValue(formData, "disputeId"),
    toStatus: formValue(formData, "toStatus"),
    resolutionNote: formValue(formData, "resolutionNote") || undefined,
  });
  if (!parsed.success) return failFields(parsed.error);

  const { disputeId, toStatus, resolutionNote } = parsed.data;
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, status: true, disputeNumber: true },
    });
    if (!dispute) return "not-found" as const;
    if (!canTransitionDispute(dispute.status, toStatus)) return "invalid-transition" as const;

    await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: toStatus,
        resolutionNote: resolutionNote ?? null,
        resolvedById: toStatus === "RESOLVED" || toStatus === "REJECTED" ? admin.id : null,
        resolvedAt: toStatus === "RESOLVED" || toStatus === "REJECTED" ? new Date() : null,
      },
    });

    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "DISPUTE_STATUS_CHANGED",
      targetType: "Dispute",
      targetId: dispute.id,
      metadata: { disputeNumber: dispute.disputeNumber, status: toStatus },
    });

    await appendOutboxEvent(tx, {
      eventType: "dispute.status_changed",
      aggregateType: "Dispute",
      aggregateId: dispute.id,
      payload: { disputeNumber: dispute.disputeNumber, status: toStatus },
    });

    return "ok" as const;
  });

  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath("/account/disputes");
  revalidatePath(`/account/disputes/${disputeId}`);
  if (result === "not-found") return fail("That dispute could not be found.");
  if (result === "invalid-transition") return fail("That status change is not allowed.");
  return ok("Dispute updated.");
}
