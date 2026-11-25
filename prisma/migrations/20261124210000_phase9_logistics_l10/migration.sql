-- Phase 9 L10: external e-commerce integrations.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_API_KEY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_API_KEY_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_WEBHOOK_ENDPOINT_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_EXTERNAL_STORE_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_WEBHOOK_DELIVERED';

CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');
CREATE TYPE "ExternalStoreStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

CREATE TABLE "logistics_api_keys" (
    "id" UUID NOT NULL,
    "key_id" VARCHAR(40) NOT NULL,
    "secret_hash" VARCHAR(128) NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "scopes" JSONB NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_api_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_api_keys_key_id_key" ON "logistics_api_keys"("key_id");
CREATE INDEX "logistics_api_keys_company_status_idx" ON "logistics_api_keys"("company_id", "status");
ALTER TABLE "logistics_api_keys" ADD CONSTRAINT "logistics_api_keys_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_api_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "company_id" UUID NOT NULL,
    "endpoint" VARCHAR(120) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_api_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_api_requests_company_idempotency_key" ON "logistics_api_requests"("company_id", "idempotency_key");
CREATE INDEX "logistics_api_requests_company_created_idx" ON "logistics_api_requests"("company_id", "created_at");
ALTER TABLE "logistics_api_requests" ADD CONSTRAINT "logistics_api_requests_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_webhook_endpoints" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(500) NOT NULL,
    "events" JSONB NOT NULL,
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_webhook_endpoints_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "logistics_webhook_endpoints_company_status_idx" ON "logistics_webhook_endpoints"("company_id", "status");
ALTER TABLE "logistics_webhook_endpoints" ADD CONSTRAINT "logistics_webhook_endpoints_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_webhook_deliveries" (
    "id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_webhook_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "logistics_webhook_deliveries_status_available_idx" ON "logistics_webhook_deliveries"("status", "available_at");
CREATE INDEX "logistics_webhook_deliveries_endpoint_created_idx" ON "logistics_webhook_deliveries"("endpoint_id", "created_at");
ALTER TABLE "logistics_webhook_deliveries" ADD CONSTRAINT "logistics_webhook_deliveries_endpoint_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "logistics_webhook_endpoints"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_external_stores" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "platform" VARCHAR(60) NOT NULL,
    "external_store_id" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "webhook_secret" VARCHAR(500) NOT NULL,
    "status" "ExternalStoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_external_stores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_external_stores_company_platform_store_key" ON "logistics_external_stores"("company_id", "platform", "external_store_id");
ALTER TABLE "logistics_external_stores" ADD CONSTRAINT "logistics_external_stores_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_external_orders" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "external_order_id" VARCHAR(120) NOT NULL,
    "delivery_request_id" UUID,
    "status" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_external_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_external_orders_store_external_key" ON "logistics_external_orders"("store_id", "external_order_id");
ALTER TABLE "logistics_external_orders" ADD CONSTRAINT "logistics_external_orders_store_fkey" FOREIGN KEY ("store_id") REFERENCES "logistics_external_stores"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_external_orders" ADD CONSTRAINT "logistics_external_orders_request_fkey" FOREIGN KEY ("delivery_request_id") REFERENCES "delivery_requests"("id") ON DELETE SET NULL;
EOF
npx prisma generate 2>&1 | tail -5