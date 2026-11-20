-- Phase 3: append-only order status history.
-- Existing orders and studio orders are backfilled with one row describing the
-- status they are in today, so the timeline is never empty for old orders.

CREATE TABLE "order_status_history" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "vendor_order_id" UUID,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus" NOT NULL,
  "actor_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_status_history_order_id_created_at_idx"
  ON "order_status_history"("order_id", "created_at");

CREATE INDEX "order_status_history_vendor_order_id_created_at_idx"
  ON "order_status_history"("vendor_order_id", "created_at");

ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_vendor_order_id_fkey"
  FOREIGN KEY ("vendor_order_id") REFERENCES "vendor_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "order_status_history" ("id", "order_id", "to_status", "note", "created_at")
SELECT gen_random_uuid(), "id", "status", 'Backfilled from the order record.', "placed_at"
FROM "orders";

INSERT INTO "order_status_history" ("id", "order_id", "vendor_order_id", "to_status", "note", "created_at")
SELECT gen_random_uuid(), "order_id", "id", "status", 'Backfilled from the studio order record.', "created_at"
FROM "vendor_orders";
