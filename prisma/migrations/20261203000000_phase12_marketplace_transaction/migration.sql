-- Phase 12: one transaction across the marketplaces.
-- A retail or produce order books a logistics job and an optional service
-- booking, with a shared, append-only status timeline.

CREATE TYPE "MarketplaceTransactionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TYPE "MarketplaceTransactionSource" AS ENUM ('RETAIL', 'AGRICULTURE');

CREATE TYPE "MarketplaceTransactionEventKind" AS ENUM (
  'CREATED',
  'LOGISTICS_BOOKED',
  'SERVICE_BOOKED',
  'LOGISTICS_UPDATE',
  'SERVICE_UPDATE',
  'COMPLETED',
  'CANCELLED'
);

ALTER TYPE "AuditAction" ADD VALUE 'MARKETPLACE_TRANSACTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MARKETPLACE_TRANSACTION_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'MARKETPLACE_TRANSACTION_CANCELLED';

CREATE TABLE "marketplace_transactions" (
  "id" UUID NOT NULL,
  "transaction_number" VARCHAR(40) NOT NULL,
  "customer_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "source" "MarketplaceTransactionSource" NOT NULL,
  "status" "MarketplaceTransactionStatus" NOT NULL DEFAULT 'OPEN',
  "currency" VARCHAR(3) NOT NULL,
  "delivery_request_id" UUID,
  "service_booking_id" UUID,
  "note" TEXT,
  "completed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "marketplace_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_transaction_events" (
  "id" UUID NOT NULL,
  "transaction_id" UUID NOT NULL,
  "kind" "MarketplaceTransactionEventKind" NOT NULL,
  "actor_id" UUID,
  "note" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_transaction_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_transactions_transaction_number_key" ON "marketplace_transactions"("transaction_number");
CREATE UNIQUE INDEX "marketplace_transactions_order_id_key" ON "marketplace_transactions"("order_id");
CREATE UNIQUE INDEX "marketplace_transactions_delivery_request_id_key" ON "marketplace_transactions"("delivery_request_id");
CREATE UNIQUE INDEX "marketplace_transactions_service_booking_id_key" ON "marketplace_transactions"("service_booking_id");
CREATE INDEX "marketplace_transactions_customer_id_created_at_idx" ON "marketplace_transactions"("customer_id", "created_at");
CREATE INDEX "marketplace_transactions_status_created_at_idx" ON "marketplace_transactions"("status", "created_at");
CREATE INDEX "marketplace_transaction_events_transaction_id_created_at_idx" ON "marketplace_transaction_events"("transaction_id", "created_at");

ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_delivery_request_id_fkey"
  FOREIGN KEY ("delivery_request_id") REFERENCES "delivery_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_service_booking_id_fkey"
  FOREIGN KEY ("service_booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_transaction_events" ADD CONSTRAINT "marketplace_transaction_events_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_transaction_events" ADD CONSTRAINT "marketplace_transaction_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
