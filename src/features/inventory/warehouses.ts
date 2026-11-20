import "server-only";

import { getDatabase } from "@/server/db/client";

export interface WarehouseSummary {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  units: number;
  productCount: number;
}

export interface ProductWarehouseBalance {
  warehouseId: string;
  name: string;
  isDefault: boolean;
  quantity: number;
}

/**
 * Resolves the vendor's default warehouse, creating it (and balance rows seeded
 * from aggregate stock) the first time a vendor is seen without one.
 */
export async function ensureDefaultWarehouse(vendorId: string): Promise<string> {
  const database = getDatabase();
  const existing = await database.warehouse.findFirst({
    where: { vendorId, isDefault: true },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  try {
    return await database.$transaction(async (transaction) => {
      const raced = await transaction.warehouse.findFirst({
        where: { vendorId, isDefault: true },
        select: { id: true },
      });

      if (raced) {
        return raced.id;
      }

      const created = await transaction.warehouse.create({
        data: { vendorId, name: "Main warehouse", code: "MAIN", isDefault: true },
        select: { id: true },
      });

      const products = await transaction.product.findMany({
        where: { vendorId },
        select: { id: true, stock: true },
      });

      if (products.length > 0) {
        await transaction.inventoryBalance.createMany({
          data: products.map((product) => ({
            warehouseId: created.id,
            productId: product.id,
            quantity: product.stock,
          })),
        });
      }

      return created.id;
    });
  } catch {
    // A concurrent request created the warehouse first; the unique code wins.
    const raced = await database.warehouse.findFirst({
      where: { vendorId, isDefault: true },
      select: { id: true },
    });

    if (raced) {
      return raced.id;
    }

    throw new Error("Could not resolve the default warehouse.");
  }
}

/**
 * Seeds a balance row for objects that have none anywhere yet (new objects, or a
 * vendor's first warehouse). Objects already stocked at another location keep
 * their units there; moving stock between locations is a transfer, not a copy.
 */
export async function syncDefaultBalances(vendorId: string): Promise<void> {
  const database = getDatabase();
  const warehouseId = await ensureDefaultWarehouse(vendorId);

  const missing = await database.product.findMany({
    where: { vendorId, inventoryBalances: { none: {} } },
    select: { id: true, stock: true },
  });

  if (missing.length === 0) {
    return;
  }

  await database.inventoryBalance.createMany({
    data: missing.map((product) => ({
      warehouseId,
      productId: product.id,
      quantity: product.stock,
    })),
    skipDuplicates: true,
  });
}

export async function listVendorWarehouses(vendorId: string): Promise<WarehouseSummary[]> {
  await ensureDefaultWarehouse(vendorId);
  await syncDefaultBalances(vendorId);

  const warehouses = await getDatabase().warehouse.findMany({
    where: { vendorId },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      isDefault: true,
      isActive: true,
      balances: { select: { quantity: true } },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return warehouses.map((warehouse) => ({
    id: warehouse.id,
    name: warehouse.name,
    code: warehouse.code,
    address: warehouse.address,
    isDefault: warehouse.isDefault,
    isActive: warehouse.isActive,
    units: warehouse.balances.reduce((total, balance) => total + balance.quantity, 0),
    productCount: warehouse.balances.filter((balance) => balance.quantity > 0).length,
  }));
}

export interface ProductTransfer {
  id: string;
  fromName: string;
  toName: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
  actorName: string | null;
}

export async function listProductTransfers(
  vendorId: string,
  productId: string,
  take = 5,
): Promise<ProductTransfer[]> {
  const transfers = await getDatabase().warehouseTransfer.findMany({
    where: { vendorId, productId },
    select: {
      id: true,
      quantity: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true } },
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return transfers.map((transfer) => ({
    id: transfer.id,
    fromName: transfer.fromWarehouse.name,
    toName: transfer.toWarehouse.name,
    quantity: transfer.quantity,
    note: transfer.note,
    createdAt: transfer.createdAt,
    actorName: transfer.actor?.name ?? null,
  }));
}

export async function getProductWarehouseBalances(
  vendorId: string,
  productId: string,
): Promise<ProductWarehouseBalance[]> {
  await ensureDefaultWarehouse(vendorId);

  // Every active warehouse is listed, including locations holding none of this
  // object yet, so a zero balance is visible rather than missing.
  const warehouses = await getDatabase().warehouse.findMany({
    where: { vendorId, isActive: true },
    select: {
      id: true,
      name: true,
      isDefault: true,
      balances: { where: { productId }, select: { quantity: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return warehouses.map((warehouse) => ({
    warehouseId: warehouse.id,
    name: warehouse.name,
    isDefault: warehouse.isDefault,
    quantity: warehouse.balances[0]?.quantity ?? 0,
  }));
}
