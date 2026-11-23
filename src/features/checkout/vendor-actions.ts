"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/lib/logging/logger";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { awardOrderPoints } from "@/features/loyalty/service";
import { shipmentSchema } from "@/features/shipments/validation";
import { nextVendorOrderStatus } from "./status";
import { recordOrderStatusChange } from "./status-history";

const fulfillmentSchema = z.object({
  vendorOrderId: z.string().uuid(),
  status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"]),
});

export async function updateVendorOrderStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("orders.fulfill", "/vendor/orders");
  const parsed = fulfillmentSchema.safeParse({
    vendorOrderId: formData.get("vendorOrderId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { status: "error", message: "The order update is invalid." };

  const shipment =
    parsed.data.status === "SHIPPED"
      ? shipmentSchema.safeParse({
          carrier: formValue(formData, "carrier"),
          trackingNumber: formValue(formData, "trackingNumber"),
          trackingUrl: formValue(formData, "trackingUrl"),
        })
      : null;

  if (shipment && !shipment.success) {
    return { status: "error", fieldErrors: firstFieldErrors(shipment.error) };
  }

  const database = getDatabase();
  try {
    const result = await database.$transaction(async (transaction) => {
      const current = await transaction.vendorOrder.findFirst({
        where: { id: parsed.data.vendorOrderId, vendorId },
        select: { id: true, orderId: true, status: true },
      });
      if (!current) return "not-found" as const;
      const allowedNext = nextVendorOrderStatus(current.status);
      if (!allowedNext || allowedNext !== parsed.data.status) return "invalid-transition" as const;

      const changed = await transaction.vendorOrder.updateMany({
        where: { id: current.id, vendorId, status: current.status },
        data: { status: parsed.data.status },
      });
      if (changed.count !== 1) return "conflict" as const;

      const tracking = shipment?.success ? shipment.data : null;

      if (parsed.data.status === "SHIPPED" && tracking) {
        const shippedAt = new Date();
        await transaction.shipment.upsert({
          where: { vendorOrderId: current.id },
          create: {
            vendorOrderId: current.id,
            vendorId,
            carrier: tracking.carrier,
            trackingNumber: tracking.trackingNumber,
            trackingUrl: tracking.trackingUrl ?? null,
            shippedAt,
          },
          update: {
            carrier: tracking.carrier,
            trackingNumber: tracking.trackingNumber,
            trackingUrl: tracking.trackingUrl ?? null,
            shippedAt,
            deliveredAt: null,
          },
        });

        await recordAuditEvent(transaction, {
          actorId: actor.id,
          action: "SHIPMENT_RECORDED",
          targetType: "vendor_order",
          targetId: current.id,
          metadata: { carrier: tracking.carrier, trackingNumber: tracking.trackingNumber },
        });
      }

      if (parsed.data.status === "DELIVERED") {
        await transaction.shipment.updateMany({
          where: { vendorOrderId: current.id, deliveredAt: null },
          data: { deliveredAt: new Date() },
        });
      }

      await recordOrderStatusChange(transaction, {
        orderId: current.orderId,
        vendorOrderId: current.id,
        fromStatus: current.status,
        toStatus: parsed.data.status,
        actorId: actor.id,
        note:
          parsed.data.status === "SHIPPED" && tracking
            ? `Shipped with ${tracking.carrier}, tracking ${tracking.trackingNumber}.`
            : "Updated from the studio.",
      });

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "ORDER_STATUS_UPDATED",
        targetType: "vendor_order",
        targetId: current.id,
        metadata: { from: current.status, to: parsed.data.status },
      });
      const siblingStatuses = await transaction.vendorOrder.findMany({
        where: { orderId: current.orderId },
        select: { status: true },
      });
      const aggregate = siblingStatuses.every((entry) => entry.status === "DELIVERED")
        ? "DELIVERED"
        : siblingStatuses.every((entry) => ["SHIPPED", "DELIVERED"].includes(entry.status))
          ? "SHIPPED"
          : siblingStatuses.some((entry) =>
                ["PROCESSING", "SHIPPED", "DELIVERED"].includes(entry.status),
              )
            ? "PROCESSING"
            : null;
      if (aggregate) {
        const parent = await transaction.order.findUnique({
          where: { id: current.orderId },
          select: { status: true, total: true, customerId: true },
        });
        if (
          parent &&
          ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(parent.status) &&
          parent.status !== aggregate
        ) {
          await transaction.order.update({
            where: { id: current.orderId },
            data: { status: aggregate },
          });

          await recordOrderStatusChange(transaction, {
            orderId: current.orderId,
            fromStatus: parent.status,
            toStatus: aggregate,
            actorId: actor.id,
            note: "Every studio reached this stage.",
          });
          await recordAuditEvent(transaction, {
            actorId: actor.id,
            action: "ORDER_STATUS_UPDATED",
            targetType: "order",
            targetId: current.orderId,
            metadata: { from: parent.status, to: aggregate, source: "vendor_fulfillment" },
          });

          if (aggregate === "DELIVERED") {
            await awardOrderPoints(transaction, {
              orderId: current.orderId,
              customerId: parent.customerId,
              total: parent.total,
              actorId: actor.id,
            });
          }
        }
      }
      return "updated" as const;
    });
    if (result !== "updated") {
      return {
        status: "error",
        message:
          result === "not-found"
            ? "That order is no longer available."
            : "That order changed or cannot move to the requested status.",
      };
    }
    revalidatePath("/vendor/orders");
    revalidatePath("/account/orders");
    return { status: "success", message: "Order status updated." };
  } catch (error) {
    logger.error("vendor.order_status_update_failed", { actorId: actor.id, error });
    return { status: "error", message: "The order could not be updated." };
  }
}
