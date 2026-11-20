-- Phase 2: inventory movements now record which warehouse changed.
-- Nullable so historical rows survive; existing rows are pointed at the vendor's
-- default warehouse where one exists.

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "warehouse_id" UUID;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "inventory_movements_warehouse_id_created_at_idx" ON "inventory_movements"("warehouse_id", "created_at");

-- Backfill
UPDATE "inventory_movements" m
SET "warehouse_id" = w."id"
FROM "products" p
JOIN "warehouses" w ON w."vendor_id" = p."vendor_id" AND w."is_default" = true
WHERE m."product_id" = p."id";
