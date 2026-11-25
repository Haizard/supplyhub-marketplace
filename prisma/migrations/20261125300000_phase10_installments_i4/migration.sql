-- Phase 10 I4: installment stock reservations and POS-backed agreements.

ALTER TYPE "InventoryReason" ADD VALUE 'RESERVE';

ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_STOCK_RESERVED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_STOCK_SOLD';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_STOCK_RELEASED';

CREATE TYPE "InstallmentStockReservationStatus" AS ENUM ('HELD', 'SOLD', 'RELEASED');

CREATE TABLE "installment_stock_reservations" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InstallmentStockReservationStatus" NOT NULL DEFAULT 'HELD',
    "sold_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_stock_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_stock_reservations_agreement_key" UNIQUE ("agreement_id"),
    CONSTRAINT "installment_stock_reservations_positive" CHECK ("quantity" > 0)
);
CREATE INDEX "installment_stock_reservations_product_status_idx" ON "installment_stock_reservations"("product_id", "status");
ALTER TABLE "installment_stock_reservations" ADD CONSTRAINT "installment_stock_reservations_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_stock_reservations" ADD CONSTRAINT "installment_stock_reservations_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "installment_stock_reservations" ADD CONSTRAINT "installment_stock_reservations_warehouse_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
