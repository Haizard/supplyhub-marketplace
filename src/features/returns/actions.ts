"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { ReturnReason } from "@/generated/prisma/enums";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { createReturnNumber } from "@/features/returns/return-number";
import { RETURNABLE_ORDER_STATUSES } from "@/features/returns/queries";
import { returnDecisionSchema, returnRequestSchema } from "@/features/returns/validation";
import { logger } from "@/lib/logging/logger";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

const uuidSchema = z.uuid();
const reasonSchema = z.enum(["DAMAGED", "NOT_AS_DESCRIBED", "WRONG_ITEM", "CHANGED_MIND", "OTHER"]);

const QUANTITY_PREFIX = "quantity:";

function readRequestedQuantities(formData: FormData): Map<string, number> {
  const wanted = new Map<string, number>();

  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith(QUANTITY_PREFIX) || typeof raw !== "string") {
      continue;
    }

    const orderItemId = key.slice(QUANTITY_PREFIX.length);
    const quantity = Number(raw);

    if (uuidSchema.safeParse(orderItemId).success && Number.isInteger(quantity) && quantity > 0) {
      wanted.set(orderItemId, quantity);
    }
  }

  return wanted;
}

function isReturnNumberCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("return_number")
  );
}

export async function requestReturnAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();

  if (!actor) {
    return { status: "error", message: "Sign in to start a return." };
  }

  const parsed = returnRequestSchema.safeParse({
    vendorOrderId: formValue(formData, "vendorOrderId"),
    note: formValue(formData, "note"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const wanted = readRequestedQuantities(formData);

  if (wanted.size === 0) {
    return { status: "error", message: "Choose at least one object and a quantity to return." };
  }

  const reasons = new Map<string, ReturnReason>();

  for (const orderItemId of wanted.keys()) {
    const parsedReason = reasonSchema.safeParse(formValue(formData, `reason:${orderItemId}`));

    if (!parsedReason.success) {
      return { status: "error", message: "Choose a reason for every object you return." };
    }

    reasons.set(orderItemId, parsedReason.data);
  }

  const database = getDatabase();

  try {
    await database.$transaction(async (transaction) => {
      const vendorOrder = await transaction.vendorOrder.findFirst({
        where: {
          id: parsed.data.vendorOrderId,
          order: {
            customerId: actor.id,
            status: { in: [...RETURNABLE_ORDER_STATUSES] },
          },
        },
        select: {
          id: true,
          order: { select: { id: true, orderNumber: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              returnItem: { select: { id: true } },
            },
          },
        },
      });

      if (!vendorOrder) {
        throw new Error("This studio order is not open for returns.");
      }

      const returnableIds = new Set(
        vendorOrder.items.filter((item) => !item.returnItem).map((item) => item.id),
      );

      for (const [orderItemId, quantity] of wanted) {
        const item = vendorOrder.items.find((candidate) => candidate.id === orderItemId);

        if (!item || !returnableIds.has(orderItemId)) {
          throw new Error("One of the chosen objects is no longer returnable.");
        }

        if (quantity > item.quantity) {
          throw new Error("You asked for more than you ordered.");
        }
      }

      const existing = await transaction.returnRequest.count({
        where: { vendorOrderId: vendorOrder.id, status: { in: ["REQUESTED", "APPROVED"] } },
      });

      if (existing > 0) {
        throw new Error("A return for this studio order is already being reviewed.");
      }

      const returnRequest = await transaction.returnRequest.create({
        data: {
          returnNumber: createReturnNumber(),
          orderId: vendorOrder.order.id,
          vendorOrderId: vendorOrder.id,
          customerId: actor.id,
          note: parsed.data.note ?? null,
          items: {
            create: [...wanted.entries()].map(([orderItemId, quantity]) => ({
              orderItemId,
              quantity,
              reason: reasons.get(orderItemId)!,
            })),
          },
        },
        select: { id: true, returnNumber: true },
      });

      logger.info("return.requested", {
        actorId: actor.id,
        returnNumber: returnRequest.returnNumber,
        orderNumber: vendorOrder.order.orderNumber,
      });
    });
  } catch (error) {
    if (isReturnNumberCollision(error)) {
      return { status: "error", message: "The return could not be created. Try again." };
    }

    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }

    throw error;
  }

  revalidatePath("/account/orders");
  revalidatePath("/orders", "layout");
  revalidatePath("/vendor/returns");

  return { status: "success", message: "Return requested. The studio will review it." };
}

export async function decideReturnAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("orders.fulfill", "/vendor/returns");

  const parsed = returnDecisionSchema.safeParse({
    returnId: formValue(formData, "returnId"),
    decision: formValue(formData, "decision"),
    vendorNote: formValue(formData, "vendorNote"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const database = getDatabase();

  const result = await database.$transaction(async (transaction) => {
    const returnRequest = await transaction.returnRequest.findFirst({
      where: { id: parsed.data.returnId, vendorOrder: { vendorId } },
      select: { id: true, status: true, returnNumber: true },
    });

    if (!returnRequest) {
      return "not-found" as const;
    }

    const allowed =
      (returnRequest.status === "REQUESTED" &&
        (parsed.data.decision === "APPROVED" || parsed.data.decision === "REJECTED")) ||
      (returnRequest.status === "APPROVED" && parsed.data.decision === "COMPLETED");

    if (!allowed) {
      return "invalid-transition" as const;
    }

    const now = new Date();

    await transaction.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        status: parsed.data.decision,
        vendorNote: parsed.data.vendorNote ?? undefined,
        decidedAt: parsed.data.decision === "COMPLETED" ? undefined : now,
        completedAt: parsed.data.decision === "COMPLETED" ? now : null,
      },
    });

    logger.info("return.decided", {
      actorId: actor.id,
      returnNumber: returnRequest.returnNumber,
      decision: parsed.data.decision,
    });

    return "ok" as const;
  });

  if (result === "not-found") {
    return { status: "error", message: "That return could not be found." };
  }

  if (result === "invalid-transition") {
    return { status: "error", message: "That return has already been decided." };
  }

  revalidatePath("/vendor/returns");
  revalidatePath("/orders", "layout");

  return {
    status: "success",
    message:
      parsed.data.decision === "APPROVED"
        ? "Return approved. Ask the buyer to send it back."
        : parsed.data.decision === "REJECTED"
          ? "Return declined."
          : "Return marked complete.",
  };
}
