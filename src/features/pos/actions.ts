"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DEFAULT_CURRENCY } from "@/features/catalog/constants";
import {
  centsToDecimalString,
  decimalToCents,
  formatMoney,
  parseMoneyToCents,
} from "@/features/catalog/money";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";

import { saleSubtotalCents } from "./calculation";
import {
  closeSessionSchema,
  expenseSchema,
  openSessionSchema,
  recordSaleSchema,
} from "./validation";

const POS_PATH = "/vendor/pos";

class PosError extends Error {}

function errorState(message: string, fieldErrors?: Record<string, string>): FormState {
  return { status: "error", message, fieldErrors };
}

/**
 * Records a counter sale against the open register session.
 *
 * The sale, its stock movement, and the stock decrement happen in one transaction,
 * so the storefront can never sell a unit the counter already sold.
 */
export async function recordSaleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("pos.sale.create", POS_PATH);

  const parsed = recordSaleSchema.safeParse({
    items: formValue(formData, "items"),
    method: formValue(formData, "method"),
    tendered: formValue(formData, "tendered"),
    reference: formValue(formData, "reference"),
  });

  if (!parsed.success) {
    return errorState("Check the sale details and try again.", firstFieldErrors(parsed.error));
  }

  const wanted = new Map<
    string,
    { productId: string; variantId: string | null; quantity: number }
  >();
  for (const line of parsed.data.items) {
    const key = `${line.productId}:${line.variantId ?? ""}`;
    const existing = wanted.get(key);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      wanted.set(key, {
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
      });
    }
  }

  const database = getDatabase();

  try {
    const saleNumber = await database.$transaction(async (transaction) => {
      const session = await transaction.posSession.findFirst({
        where: { vendorId, status: "OPEN" },
        select: { id: true },
      });

      if (!session) {
        throw new PosError("Open a register session before recording a sale.");
      }

      const warehouse = await transaction.warehouse.findFirst({
        where: { vendorId, isDefault: true },
        select: { id: true, name: true },
      });

      if (!warehouse) {
        throw new PosError("This studio has no default warehouse. Set one on the Warehouses page.");
      }

      const productIds = [...new Set([...wanted.values()].map((line) => line.productId))];

      for (const line of wanted.values()) {
        if (line.quantity > 99) {
          throw new PosError("Sell at most 99 units per object and option.");
        }
      }

      const products = await transaction.product.findMany({
        where: { id: { in: productIds }, vendorId, status: "PUBLISHED" },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          costPrice: true,
          stock: true,
          currency: true,
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { id: true, name: true, sku: true, price: true, stock: true },
          },
        },
      });

      if (products.length !== productIds.length) {
        throw new PosError("One of those objects is no longer on sale. Reload and try again.");
      }

      const productsById = new Map(products.map((product) => [product.id, product]));

      const currencies = new Set(products.map((product) => product.currency));
      if (currencies.size !== 1) {
        throw new PosError("Objects in one sale must use the same currency.");
      }

      const currency = products[0]?.currency ?? DEFAULT_CURRENCY;
      const lines = [...wanted.values()].map((line) => {
        const product = productsById.get(line.productId);

        if (!product) {
          throw new PosError("One of those objects is no longer on sale. Reload and try again.");
        }

        const variant = line.variantId
          ? (product.variants.find((entry) => entry.id === line.variantId) ?? null)
          : null;

        if (line.variantId && !variant) {
          throw new PosError(
            `${product.name}: that option is no longer on sale. Reload and try again.`,
          );
        }

        if (!variant && product.variants.length > 0) {
          throw new PosError(`${product.name} sells by option. Choose one before selling it.`);
        }

        return {
          productId: product.id,
          productName: product.name,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          sku: variant?.sku ?? product.sku,
          unitPriceCents: decimalToCents(variant?.price ?? product.price),
          unitCostCents: product.costPrice === null ? null : decimalToCents(product.costPrice),
          quantity: line.quantity,
          stock: variant?.stock ?? product.stock,
          productStock: product.stock,
        };
      });

      const subtotalCents = saleSubtotalCents(
        lines.map((line) => ({ unitPriceCents: line.unitPriceCents, quantity: line.quantity })),
      );

      if (subtotalCents === null || subtotalCents <= 0) {
        throw new PosError("The sale total is not valid.");
      }

      if (parsed.data.method === "CASH") {
        const tendered = parseMoneyToCents(formValue(formData, "tendered")) ?? 0;
        if (tendered !== 0 && tendered < subtotalCents) {
          throw new PosError("The cash tendered is less than the sale total.");
        }
      }

      for (const line of lines) {
        const optionLabel = line.variantName
          ? `${line.productName} (${line.variantName})`
          : line.productName;

        if (line.quantity > line.stock) {
          throw new PosError(
            `${optionLabel} has ${line.stock} ${
              line.stock === 1 ? "unit" : "units"
            } left. Adjust the quantity.`,
          );
        }

        const balance = await transaction.inventoryBalance.findUnique({
          where: {
            warehouseId_productId: { warehouseId: warehouse.id, productId: line.productId },
          },
          select: { quantity: true },
        });
        const atLocation = balance?.quantity ?? 0;

        if (line.quantity > atLocation) {
          throw new PosError(
            `${line.productName} has ${atLocation} ${
              atLocation === 1 ? "unit" : "units"
            } at ${warehouse.name}. Restock or transfer stock there first.`,
          );
        }

        const moved = await transaction.inventoryBalance.updateMany({
          where: {
            warehouseId: warehouse.id,
            productId: line.productId,
            quantity: { gte: line.quantity },
          },
          data: { quantity: { decrement: line.quantity } },
        });

        if (moved.count !== 1) {
          throw new PosError(
            `${line.productName} sold out at ${warehouse.name} while you were recording. Try again.`,
          );
        }

        const updated = await transaction.product.updateMany({
          where: { id: line.productId, vendorId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });

        if (updated.count !== 1) {
          throw new PosError(`${line.productName} sold out while you were recording. Try again.`);
        }

        if (line.variantId) {
          const variantUpdated = await transaction.productVariant.updateMany({
            where: {
              id: line.variantId,
              productId: line.productId,
              isActive: true,
              stock: { gte: line.quantity },
            },
            data: { stock: { decrement: line.quantity } },
          });

          if (variantUpdated.count !== 1) {
            throw new PosError(`${optionLabel} sold out while you were recording. Try again.`);
          }
        }

        const current = await transaction.product.findUnique({
          where: { id: line.productId },
          select: { stock: true },
        });

        await transaction.inventoryMovement.create({
          data: {
            productId: line.productId,
            actorId: actor.id,
            warehouseId: warehouse.id,
            delta: -line.quantity,
            reason: "SALE",
            resultingStock: current?.stock ?? line.productStock - line.quantity,
            note: line.variantName
              ? `Sold at the counter: ${line.variantName}.`
              : "Sold at the counter.",
          },
        });
      }

      const saleNumber = `POS-${Date.now().toString(36).toUpperCase()}-${randomUUID()
        .slice(0, 4)
        .toUpperCase()}`;

      const sale = await transaction.sale.create({
        data: {
          vendorId,
          sessionId: session.id,
          saleNumber,
          currency,
          subtotal: centsToDecimalString(subtotalCents),
          total: centsToDecimalString(subtotalCents),
          soldById: actor.id,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              variantId: line.variantId,
              variantName: line.variantName,
              sku: line.sku,
              unitPrice: centsToDecimalString(line.unitPriceCents),
              unitCost:
                line.unitCostCents === null ? null : centsToDecimalString(line.unitCostCents),
              quantity: line.quantity,
              lineTotal: centsToDecimalString(line.unitPriceCents * line.quantity),
              currency,
            })),
          },
          payments: {
            create: {
              method: parsed.data.method,
              amount: centsToDecimalString(subtotalCents),
              reference: parsed.data.reference ?? null,
            },
          },
        },
        select: { id: true },
      });

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "POS_SALE_RECORDED",
        targetType: "sale",
        targetId: sale.id,
        metadata: {
          saleNumber,
          totalCents: subtotalCents,
          method: parsed.data.method,
          lines: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        },
      });

      return saleNumber;
    });

    logger.info("pos.sale_recorded", { actorId: actor.id, vendorId, saleNumber });
    revalidatePath(POS_PATH);
    revalidatePath("/vendor/products");
    revalidatePath("/", "layout");
    redirect(`${POS_PATH}?sold=${encodeURIComponent(saleNumber)}`);
  } catch (error) {
    if (error instanceof PosError) {
      return errorState(error.message);
    }

    throw error;
  }
}

export async function openSessionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("pos.sale.create", POS_PATH);

  const parsed = openSessionSchema.safeParse({
    openingFloat: formValue(formData, "openingFloat"),
  });

  if (!parsed.success) {
    return errorState("Enter the cash in the drawer.", firstFieldErrors(parsed.error));
  }

  const openingFloatCents = parseMoneyToCents(formValue(formData, "openingFloat")) ?? 0;
  const database = getDatabase();

  const existing = await database.posSession.findFirst({
    where: { vendorId, status: "OPEN" },
    select: { id: true },
  });

  if (existing) {
    return errorState("This studio already has an open register session.");
  }

  const register =
    (await database.posRegister.findFirst({
      where: { vendorId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await database.posRegister.create({
      data: { vendorId, name: "Main register" },
      select: { id: true },
    }));

  const session = await database.posSession.create({
    data: {
      vendorId,
      registerId: register.id,
      currency: DEFAULT_CURRENCY,
      openingFloat: centsToDecimalString(openingFloatCents),
      openedById: actor.id,
    },
    select: { id: true },
  });

  await database.$transaction((transaction) =>
    recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "POS_SESSION_OPENED",
      targetType: "pos_session",
      targetId: session.id,
      metadata: { openingFloatCents },
    }),
  );

  logger.info("pos.session_opened", { actorId: actor.id, vendorId, sessionId: session.id });
  revalidatePath(POS_PATH);

  return { status: "success", message: "Register session opened. You can start selling." };
}

export async function closeSessionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("pos.register.close", POS_PATH);

  const parsed = closeSessionSchema.safeParse({
    countedCash: formValue(formData, "countedCash"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    return errorState("Check the cash count and try again.", firstFieldErrors(parsed.error));
  }

  const countedCashCents = parseMoneyToCents(formValue(formData, "countedCash"));
  if (countedCashCents === null) {
    return errorState("Enter a valid cash amount.", { countedCash: "Enter a valid amount." });
  }

  const database = getDatabase();
  const session = await database.posSession.findFirst({
    where: { vendorId, status: "OPEN" },
    select: { id: true, openingFloat: true },
  });

  if (!session) {
    return errorState("There is no open register session to close.");
  }

  const cashTotal = await database.salePayment.aggregate({
    where: { method: "CASH", sale: { sessionId: session.id, vendorId } },
    _sum: { amount: true },
  });

  const expectedCashCents =
    decimalToCents(session.openingFloat) + decimalToCents(cashTotal._sum.amount ?? 0);
  const differenceCents = countedCashCents - expectedCashCents;

  const closed = await database.posSession.updateMany({
    where: { id: session.id, vendorId, status: "OPEN" },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: actor.id,
      expectedCash: centsToDecimalString(expectedCashCents),
      countedCash: centsToDecimalString(countedCashCents),
      notes: parsed.data.notes ?? null,
    },
  });

  if (closed.count !== 1) {
    return errorState("That session was already closed. Reload the page.");
  }

  await database.$transaction((transaction) =>
    recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "POS_SESSION_CLOSED",
      targetType: "pos_session",
      targetId: session.id,
      metadata: {
        expectedCashCents,
        countedCashCents,
        differenceCents,
        salesCount: 0,
      },
    }),
  );

  logger.info("pos.session_closed", {
    actorId: actor.id,
    vendorId,
    sessionId: session.id,
    differenceCents,
  });
  revalidatePath(POS_PATH);
  redirect(`${POS_PATH}?closed=1`);
}

export async function recordExpenseAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor, vendorId } = await requireStudioAccess("finance.expense.create", POS_PATH);

  const parsed = expenseSchema.safeParse({
    category: formValue(formData, "category"),
    description: formValue(formData, "description"),
    amount: formValue(formData, "amount"),
  });

  if (!parsed.success) {
    return errorState("Check the expense details and try again.", firstFieldErrors(parsed.error));
  }

  const amountCents = parseMoneyToCents(formValue(formData, "amount"));
  if (amountCents === null || amountCents <= 0) {
    return errorState("Enter a valid amount.", { amount: "Enter a valid amount." });
  }

  const database = getDatabase();
  const expense = await database.expense.create({
    data: {
      vendorId,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: centsToDecimalString(amountCents),
      currency: DEFAULT_CURRENCY,
      createdById: actor.id,
    },
    select: { id: true },
  });

  await database.$transaction((transaction) =>
    recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "EXPENSE_RECORDED",
      targetType: "expense",
      targetId: expense.id,
      metadata: { amountCents, category: parsed.data.category },
    }),
  );

  logger.info("pos.expense_recorded", { actorId: actor.id, vendorId, expenseId: expense.id });
  revalidatePath(POS_PATH);

  return {
    status: "success",
    message: `Expense of ${formatMoney(amountCents)} recorded.`,
  };
}
