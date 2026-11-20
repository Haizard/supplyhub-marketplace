-- Phase 2: multi-warehouse inventory.
-- Every vendor gets one default warehouse; every existing object is backed by a
-- balance there equal to its current stock, so aggregate stock never changes.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WAREHOUSE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WAREHOUSE_DEFAULT_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVENTORY_TRANSFERRED';

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouses_vendor_id_idx" ON "warehouses"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_vendor_id_code_key" ON "warehouses"("vendor_id", "code");

-- CreateIndex
CREATE INDEX "inventory_balances_product_id_idx" ON "inventory_balances"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_warehouse_id_product_id_key" ON "inventory_balances"("warehouse_id", "product_id");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one default warehouse per vendor.
INSERT INTO "warehouses" ("id", "vendor_id", "name", "code", "is_default", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), v."id", 'Main warehouse', 'MAIN', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "vendors" v;

-- Backfill: one balance per object at its vendor's default warehouse, seeded from
-- the aggregate stock so product.stock stays the source of truth on day one.
INSERT INTO "inventory_balances" ("id", "warehouse_id", "product_id", "quantity", "updated_at")
SELECT gen_random_uuid(), w."id", p."id", p."stock", CURRENT_TIMESTAMP
FROM "products" p
JOIN "warehouses" w ON w."vendor_id" = p."vendor_id" AND w."is_default" = true;
