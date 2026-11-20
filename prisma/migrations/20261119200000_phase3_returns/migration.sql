-- Phase 3: customer-initiated returns per studio order.

CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');
CREATE TYPE "ReturnReason" AS ENUM ('DAMAGED', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'CHANGED_MIND', 'OTHER');

CREATE TABLE "returns" (
  "id" UUID NOT NULL,
  "return_number" TEXT NOT NULL,
  "order_id" UUID NOT NULL,
  "vendor_order_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "note" TEXT,
  "vendor_note" TEXT,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "returns_return_number_key" ON "returns"("return_number");
CREATE INDEX "returns_vendor_order_id_status_idx" ON "returns"("vendor_order_id", "status");
CREATE INDEX "returns_customer_id_created_at_idx" ON "returns"("customer_id", "created_at");

CREATE TABLE "return_items" (
  "id" UUID NOT NULL,
  "return_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" "ReturnReason" NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "return_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "return_items_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "return_items_order_item_id_key" ON "return_items"("order_item_id");

ALTER TABLE "returns"
  ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns"
  ADD CONSTRAINT "returns_vendor_order_id_fkey" FOREIGN KEY ("vendor_order_id") REFERENCES "vendor_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns"
  ADD CONSTRAINT "returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_items"
  ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_items"
  ADD CONSTRAINT "return_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
