import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/server/audit/audit-log";

import { canHoldStock } from "./stock-rules";

export class InstallmentStockError extends Error {}

/**
 * Holds stock for an agreement by reducing available quantities. This is not a
 * sale: a REServe movement records the hold and the reservation converts to SOLD
 * only when possession terms are met (or RELEASED on cancellation).
 */
export async function holdInstallmentStock(
  tx: Prisma.TransactionClient,
  input: {
    vendorId: string;
    productId: string;
    quantity: number;
    agreementId: string;
    actorId: string;
  },
): Promise<{ productName: string; sku: string | null; unitPrice: string; currency: string }> {
  const [warehouse, product] = await Promise.all([
    tx.warehouse.findFirst({
      where: { vendorId: input.vendorId, isDefault: true, isActive: true },
      select: { id: true, name: true },
    }),
    tx.product.findFirst({
      where: { id: input.productId, vendorId: input.vendorId, status: "PUBLISHED" },
      select: { id: true, name: true, sku: true, price: true, currency: true, stock: true },
    }),
  ]);
  if (!warehouse)
    throw new InstallmentStockError(
      "Set a default warehouse before offering stock on installments.",
    );
  if (!product) throw new InstallmentStockError("That product is not on sale in this studio.");

  const balance = await tx.inventoryBalance.findUnique({
    where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
    select: { quantity: true },
  });
  if (
    !canHoldStock({
      catalogueStock: product.stock,
      warehouseStock: balance?.quantity ?? 0,
      quantity: input.quantity,
    })
  ) {
    throw new InstallmentStockError(
      `${product.name} does not have ${input.quantity} units available.`,
    );
  }

  const moved = await tx.inventoryBalance.updateMany({
    where: {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: { gte: input.quantity },
    },
    data: { quantity: { decrement: input.quantity } },
  });
  if (moved.count !== 1)
    throw new InstallmentStockError("Stock changed while reserving. Try again.");

  const updated = await tx.product.updateMany({
    where: { id: product.id, vendorId: input.vendorId, stock: { gte: input.quantity } },
    data: { stock: { decrement: input.quantity } },
  });
  if (updated.count !== 1)
    throw new InstallmentStockError("Stock changed while reserving. Try again.");

  await tx.installmentStockReservation.create({
    data: {
      agreementId: input.agreementId,
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: input.quantity,
      status: "HELD",
    },
  });
  await tx.inventoryMovement.create({
    data: {
      productId: product.id,
      warehouseId: warehouse.id,
      actorId: input.actorId,
      delta: -input.quantity,
      reason: "RESERVE",
      resultingStock: product.stock - input.quantity,
      note: `Held for installment agreement ${input.agreementId.slice(0, 8)}.`,
    },
  });
  await recordAuditEvent(tx, {
    actorId: input.actorId,
    action: "INSTALLMENT_STOCK_RESERVED",
    targetType: "InstallmentAgreement",
    targetId: input.agreementId,
    metadata: { productId: product.id, warehouseId: warehouse.id, quantity: input.quantity },
  });

  return {
    productName: product.name,
    sku: product.sku,
    unitPrice: product.price.toString(),
    currency: product.currency,
  };
}

/** Converts held units to a sale without a second stock decrement. */
export async function markInstallmentStockSold(
  tx: Prisma.TransactionClient,
  agreementId: string,
  actorId: string | null,
): Promise<void> {
  const reservation = await tx.installmentStockReservation.findUnique({
    where: { agreementId },
    select: { id: true, status: true },
  });
  if (!reservation || reservation.status !== "HELD") return;
  await tx.installmentStockReservation.update({
    where: { id: reservation.id },
    data: { status: "SOLD", soldAt: new Date() },
  });
  await recordAuditEvent(tx, {
    actorId,
    action: "INSTALLMENT_STOCK_SOLD",
    targetType: "InstallmentStockReservation",
    targetId: reservation.id,
    metadata: { agreementId },
  });
}

/** Returns cancelled units to stock. No-op once the reservation is SOLD. */
export async function releaseInstallmentStock(
  tx: Prisma.TransactionClient,
  agreementId: string,
  actorId: string | null,
): Promise<void> {
  const reservation = await tx.installmentStockReservation.findUnique({
    where: { agreementId },
    select: { id: true, status: true, productId: true, warehouseId: true, quantity: true },
  });
  if (!reservation || reservation.status !== "HELD") return;

  await tx.inventoryBalance.updateMany({
    where: { warehouseId: reservation.warehouseId, productId: reservation.productId },
    data: { quantity: { increment: reservation.quantity } },
  });
  const product = await tx.product.findUnique({
    where: { id: reservation.productId },
    select: { stock: true },
  });
  await tx.product.update({
    where: { id: reservation.productId },
    data: { stock: { increment: reservation.quantity } },
  });
  await tx.inventoryMovement.create({
    data: {
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      actorId,
      delta: reservation.quantity,
      reason: "RELEASE",
      resultingStock: (product?.stock ?? 0) + reservation.quantity,
      note: `Released from cancelled installment agreement ${agreementId.slice(0, 8)}.`,
    },
  });
  await tx.installmentStockReservation.update({
    where: { id: reservation.id },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  await recordAuditEvent(tx, {
    actorId,
    action: "INSTALLMENT_STOCK_RELEASED",
    targetType: "InstallmentStockReservation",
    targetId: reservation.id,
    metadata: { agreementId, quantity: reservation.quantity },
  });
}
