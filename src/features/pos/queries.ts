import "server-only";

import { decimalToCents } from "@/features/catalog/money";
import { getDatabase } from "@/server/db/client";
import { mediaUrlForKey } from "@/server/storage/keys";

import { startOfDay } from "./calculation";

export interface PosProductVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
}

export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  categoryName: string;
  imageSrc: string | null;
  priceCents: number;
  currency: string;
  /** Units at the counter's location. */
  stock: number;
  /** Options the cashier must choose from; empty when the object sells as one unit. */
  variants: PosProductVariant[];
}

export interface PosSaleSummary {
  id: string;
  saleNumber: string;
  totalCents: number;
  currency: string;
  soldAt: Date;
  itemCount: number;
}

export interface PosWorkspace {
  currency: string;
  /** Counter sales take stock from this location, so product stock is its balance. */
  locationName: string | null;
  session: {
    id: string;
    registerName: string;
    openedAt: Date;
    openingFloatCents: number;
    cashSalesCents: number;
    expectedCashCents: number;
    salesCount: number;
  } | null;
  products: PosProduct[];
  today: {
    salesCount: number;
    salesTotalCents: number;
    cashTotalCents: number;
    expensesTotalCents: number;
  };
  recentSales: PosSaleSummary[];
  /** The last session closed today, so the cash reconciliation survives the form closing. */
  lastClosed: {
    expectedCents: number;
    countedCents: number;
    differenceCents: number;
  } | null;
}

/**
 * Everything the point-of-sale screen needs for one vendor, scoped to today.
 * The vendor id always comes from the authorized studio context, never the client.
 */
export async function getPosWorkspace(vendorId: string): Promise<PosWorkspace> {
  const database = getDatabase();
  const dayStart = startOfDay(new Date());

  const warehouse = await database.warehouse.findFirst({
    where: { vendorId, isDefault: true },
    select: { id: true, name: true },
  });

  const [session, products, sales, cashPayments, expenses, recentSales, lastClosed] =
    await Promise.all([
      database.posSession.findFirst({
        where: { vendorId, status: "OPEN" },
        select: {
          id: true,
          openedAt: true,
          openingFloat: true,
          register: { select: { name: true } },
        },
        orderBy: { openedAt: "desc" },
      }),
      database.product.findMany({
        where: { vendorId, status: "PUBLISHED" },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          currency: true,
          stock: true,
          inventoryBalances: {
            where: { warehouseId: warehouse?.id ?? "00000000-0000-0000-0000-000000000000" },
            select: { quantity: true },
            take: 1,
          },
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { id: true, name: true, sku: true, price: true, stock: true },
          },
          category: { select: { name: true } },
          images: {
            where: { status: "APPROVED" },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { storageKey: true },
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      database.sale.findMany({
        where: { vendorId, soldAt: { gte: dayStart } },
        select: { total: true },
      }),
      database.salePayment.aggregate({
        where: {
          method: "CASH",
          sale: { vendorId, soldAt: { gte: dayStart } },
        },
        _sum: { amount: true },
      }),
      database.expense.aggregate({
        where: { vendorId, spentAt: { gte: dayStart } },
        _sum: { amount: true },
      }),
      database.sale.findMany({
        where: { vendorId },
        select: {
          id: true,
          saleNumber: true,
          total: true,
          currency: true,
          soldAt: true,
          _count: { select: { items: true } },
        },
        orderBy: { soldAt: "desc" },
        take: 5,
      }),
      database.posSession.findFirst({
        where: { vendorId, status: "CLOSED", closedAt: { gte: dayStart } },
        select: { expectedCash: true, countedCash: true },
        orderBy: { closedAt: "desc" },
      }),
    ]);

  const salesTotalCents = sales.reduce((total, sale) => total + decimalToCents(sale.total), 0);
  const cashSalesCents = decimalToCents(cashPayments._sum.amount ?? 0);
  const openingFloatCents = session ? decimalToCents(session.openingFloat) : 0;

  return {
    currency: products[0]?.currency ?? "TZS",
    locationName: warehouse?.name ?? null,
    session: session
      ? {
          id: session.id,
          registerName: session.register.name,
          openedAt: session.openedAt,
          openingFloatCents,
          cashSalesCents,
          expectedCashCents: openingFloatCents + cashSalesCents,
          salesCount: sales.length,
        }
      : null,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryName: product.category.name,
      imageSrc: product.images[0] ? mediaUrlForKey(product.images[0].storageKey) : null,
      priceCents: decimalToCents(product.price),
      currency: product.currency,
      stock: product.inventoryBalances[0]?.quantity ?? 0,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        priceCents: decimalToCents(variant.price),
        stock: variant.stock,
      })),
    })),
    today: {
      salesCount: sales.length,
      salesTotalCents,
      cashTotalCents: cashSalesCents,
      expensesTotalCents: decimalToCents(expenses._sum.amount ?? 0),
    },
    lastClosed:
      lastClosed?.expectedCash && lastClosed.countedCash
        ? {
            expectedCents: decimalToCents(lastClosed.expectedCash),
            countedCents: decimalToCents(lastClosed.countedCash),
            differenceCents:
              decimalToCents(lastClosed.countedCash) - decimalToCents(lastClosed.expectedCash),
          }
        : null,
    recentSales: recentSales.map((sale) => ({
      id: sale.id,
      saleNumber: sale.saleNumber,
      totalCents: decimalToCents(sale.total),
      currency: sale.currency,
      soldAt: sale.soldAt,
      itemCount: sale._count.items,
    })),
  };
}
