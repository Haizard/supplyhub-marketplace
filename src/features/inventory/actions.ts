"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { MAX_UNIT_STOCK } from "@/features/catalog/inventory";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";

const PATH = "/vendor/warehouses";

const warehouseSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z
      .string({ error: "Enter a warehouse name." })
      .min(2, { error: "Use at least 2 characters." })
      .max(60, { error: "Use 60 characters or fewer." }),
  ),
  code: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z
      .string({ error: "Enter a short code." })
      .min(2, { error: "Use at least 2 characters." })
      .max(12, { error: "Use 12 characters or fewer." })
      .regex(/^[A-Z0-9-]+$/, { error: "Use letters, numbers, and hyphens only." }),
  ),
  address: z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
    z.string().max(160, { error: "Use 160 characters or fewer." }).optional(),
  ),
});

export async function createWarehouseAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("inventory.adjust", PATH);

  const parsed = warehouseSchema.safeParse({
    name: formValue(formData, "name"),
    code: formValue(formData, "code"),
    address: formValue(formData, "address"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const database = getDatabase();

  try {
    const warehouse = await database.warehouse.create({
      data: {
        vendorId,
        name: parsed.data.name,
        code: parsed.data.code,
        address: parsed.data.address ?? null,
      },
      select: { id: true, name: true },
    });

    await database.$transaction((transaction) =>
      recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "WAREHOUSE_CREATED",
        targetType: "warehouse",
        targetId: warehouse.id,
        metadata: { name: warehouse.name, code: parsed.data.code },
      }),
    );

    logger.info("warehouse.created", { actorId: actor.id, vendorId, warehouseId: warehouse.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        fieldErrors: { code: "Another warehouse already uses that code." },
      };
    }

    throw error;
  }

  revalidatePath(PATH);
  revalidatePath("/vendor");

  return { status: "success", message: `${parsed.data.name} added.` };
}

export async function setDefaultWarehouseAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("inventory.adjust", PATH);
  const parsed = z.uuid().safeParse(formValue(formData, "warehouseId"));

  if (!parsed.success) {
    return { status: "error", message: "That warehouse reference is invalid." };
  }

  const database = getDatabase();

  const warehouse = await database.warehouse.findFirst({
    where: { id: parsed.data, vendorId },
    select: { id: true, name: true, isDefault: true },
  });

  if (!warehouse) {
    return { status: "error", message: "That warehouse could not be found." };
  }

  if (warehouse.isDefault) {
    return { status: "success", message: `${warehouse.name} is already the default.` };
  }

  await database.$transaction(async (transaction) => {
    await transaction.warehouse.updateMany({
      where: { vendorId, isDefault: true },
      data: { isDefault: false },
    });

    await transaction.warehouse.updateMany({
      where: { id: warehouse.id, vendorId },
      data: { isDefault: true },
    });

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "WAREHOUSE_DEFAULT_CHANGED",
      targetType: "warehouse",
      targetId: warehouse.id,
      metadata: { name: warehouse.name },
    });
  });

  logger.info("warehouse.default_changed", {
    actorId: actor.id,
    vendorId,
    warehouseId: warehouse.id,
  });
  revalidatePath(PATH);
  revalidatePath("/vendor");

  return { status: "success", message: `${warehouse.name} is now the default warehouse.` };
}

const transferSchema = z
  .object({
    productId: z.uuid({ error: "That object reference is invalid." }),
    fromWarehouseId: z.uuid({ error: "Choose where stock is moving from." }),
    toWarehouseId: z.uuid({ error: "Choose where stock is moving to." }),
    quantity: z.preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
      z
        .number({ error: "Enter a whole number of units." })
        .int({ error: "Enter a whole number of units." })
        .min(1, { error: "Transfer at least one unit." })
        .max(MAX_UNIT_STOCK, { error: "That is more units than a location can hold." }),
    ),
    note: z.preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
      z.string().max(200, { error: "Use 200 characters or fewer." }).optional(),
    ),
  })
  .refine((value) => value.fromWarehouseId !== value.toWarehouseId, {
    path: ["toWarehouseId"],
    message: "Choose a different destination.",
  });

class TransferError extends Error {}

export async function transferStockAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("inventory.adjust", PATH);

  const parsed = transferSchema.safeParse({
    productId: formValue(formData, "productId"),
    fromWarehouseId: formValue(formData, "fromWarehouseId"),
    toWarehouseId: formValue(formData, "toWarehouseId"),
    quantity: formValue(formData, "quantity"),
    note: formValue(formData, "note"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const database = getDatabase();

  try {
    const message = await database.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: parsed.data.productId, vendorId },
        select: { id: true, name: true, status: true },
      });

      if (!product) {
        throw new TransferError("That object could not be found in your studio.");
      }

      if (product.status === "ARCHIVED") {
        throw new TransferError("Archived objects cannot be transferred.");
      }

      const warehouses = await transaction.warehouse.findMany({
        where: {
          id: { in: [parsed.data.fromWarehouseId, parsed.data.toWarehouseId] },
          vendorId,
          isActive: true,
        },
        select: { id: true, name: true },
      });

      if (warehouses.length !== 2) {
        throw new TransferError("Choose two of your active warehouses.");
      }

      const from = warehouses.find((warehouse) => warehouse.id === parsed.data.fromWarehouseId);
      const to = warehouses.find((warehouse) => warehouse.id === parsed.data.toWarehouseId);

      if (!from || !to) {
        throw new TransferError("Choose two of your active warehouses.");
      }

      const fromBalance = await transaction.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: { warehouseId: from.id, productId: product.id },
        },
        select: { id: true, quantity: true },
      });

      if (!fromBalance || fromBalance.quantity < parsed.data.quantity) {
        const available = fromBalance?.quantity ?? 0;
        throw new TransferError(
          `${from.name} has ${available} ${available === 1 ? "unit" : "units"} of ${product.name}.`,
        );
      }

      const moved = await transaction.inventoryBalance.updateMany({
        where: {
          id: fromBalance.id,
          quantity: { gte: parsed.data.quantity },
        },
        data: { quantity: { decrement: parsed.data.quantity } },
      });

      if (moved.count !== 1) {
        throw new TransferError("Stock changed while you were transferring. Try again.");
      }

      await transaction.inventoryBalance.upsert({
        where: {
          warehouseId_productId: { warehouseId: to.id, productId: product.id },
        },
        create: {
          warehouseId: to.id,
          productId: product.id,
          quantity: parsed.data.quantity,
        },
        update: { quantity: { increment: parsed.data.quantity } },
      });

      await transaction.warehouseTransfer.create({
        data: {
          vendorId,
          productId: product.id,
          fromWarehouseId: from.id,
          toWarehouseId: to.id,
          quantity: parsed.data.quantity,
          note: parsed.data.note ?? null,
          actorId: actor.id,
        },
      });

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "INVENTORY_TRANSFERRED",
        targetType: "product",
        targetId: product.id,
        metadata: {
          fromWarehouseId: from.id,
          toWarehouseId: to.id,
          quantity: parsed.data.quantity,
        },
      });

      return `Moved ${parsed.data.quantity} ${
        parsed.data.quantity === 1 ? "unit" : "units"
      } from ${from.name} to ${to.name}.`;
    });

    logger.info("inventory.transferred", {
      actorId: actor.id,
      vendorId,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
    });
    revalidatePath(PATH);
    revalidatePath(`/vendor/products/${parsed.data.productId}`);

    return { status: "success", message };
  } catch (error) {
    if (error instanceof TransferError) {
      return { status: "error", message: error.message };
    }

    throw error;
  }
}

/** Form-action wrapper for the per-row default switch. */
export async function setDefaultWarehouseFormAction(formData: FormData): Promise<void> {
  await setDefaultWarehouseAction({ status: "idle" }, formData);
}
