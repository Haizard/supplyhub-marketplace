-- Phase 7 ecosystem: services marketplace, group buying, regional logistics.
-- All slices are gated behind feature flags that default to disabled.

-- New audit actions for Phase 7 domain events.
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_LISTING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_LISTING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_LISTING_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_BOOKING_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_BOOKING_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_BOOKING_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_BOOKING_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_CAMPAIGN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_CAMPAIGN_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_JOINED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_LEFT';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_CAMPAIGN_FUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_CAMPAIGN_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BUY_CAMPAIGN_EXPIRED';
ALTER TYPE "AuditAction" ADD VALUE 'REGIONAL_CORRIDOR_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'REGIONAL_CORRIDOR_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'REGIONAL_CORRIDOR_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'REGIONAL_CORRIDOR_DEACTIVATED';

-- ── Services marketplace ───────────────────────────────────────────────────

CREATE TYPE "ServiceListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "ServiceBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "service_listings" (
    "id" UUID NOT NULL,
    "listing_number" VARCHAR NOT NULL,
    "vendor_id" UUID NOT NULL,
    "business_id" UUID,
    "title" VARCHAR NOT NULL,
    "description" VARCHAR NOT NULL DEFAULT '',
    "category_id" UUID,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "unit_price" DECIMAL(12,2) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "location" VARCHAR NOT NULL DEFAULT '',
    "status" "ServiceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_listings_listing_number_key" ON "service_listings"("listing_number");
CREATE INDEX "service_listings_vendor_id_status_idx" ON "service_listings"("vendor_id", "status");
CREATE INDEX "service_listings_status_published_at_idx" ON "service_listings"("status", "published_at");

ALTER TABLE "service_listings"
    ADD CONSTRAINT "service_listings_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;
ALTER TABLE "service_listings"
    ADD CONSTRAINT "service_listings_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL;
ALTER TABLE "service_listings"
    ADD CONSTRAINT "service_listings_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL;

CREATE TABLE "service_bookings" (
    "id" UUID NOT NULL,
    "booking_number" VARCHAR NOT NULL,
    "service_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "unit_price" DECIMAL(12,2) NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ServiceBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_bookings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_bookings_booking_number_key" ON "service_bookings"("booking_number");
CREATE INDEX "service_bookings_service_id_status_idx" ON "service_bookings"("service_id", "status");
CREATE INDEX "service_bookings_buyer_id_created_at_idx" ON "service_bookings"("buyer_id", "created_at");
CREATE INDEX "service_bookings_vendor_id_status_idx" ON "service_bookings"("vendor_id", "status");

ALTER TABLE "service_bookings"
    ADD CONSTRAINT "service_bookings_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "service_listings"("id") ON DELETE CASCADE;
ALTER TABLE "service_bookings"
    ADD CONSTRAINT "service_bookings_buyer_id_fkey"
    FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "service_bookings"
    ADD CONSTRAINT "service_bookings_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;

-- ── Group / community buying ───────────────────────────────────────────────

CREATE TYPE "GroupBuyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FUNDED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "group_buy_campaigns" (
    "id" UUID NOT NULL,
    "campaign_number" VARCHAR NOT NULL,
    "vendor_id" UUID NOT NULL,
    "business_id" UUID,
    "product_id" UUID,
    "title" VARCHAR NOT NULL,
    "description" VARCHAR NOT NULL DEFAULT '',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "base_price" DECIMAL(12,2) NOT NULL,
    "target_quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "status" "GroupBuyStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "funded_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "group_buy_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_buy_campaigns_campaign_number_key" ON "group_buy_campaigns"("campaign_number");
CREATE INDEX "group_buy_campaigns_vendor_id_status_idx" ON "group_buy_campaigns"("vendor_id", "status");
CREATE INDEX "group_buy_campaigns_status_ends_at_idx" ON "group_buy_campaigns"("status", "ends_at");

ALTER TABLE "group_buy_campaigns"
    ADD CONSTRAINT "group_buy_campaigns_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;
ALTER TABLE "group_buy_campaigns"
    ADD CONSTRAINT "group_buy_campaigns_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL;
ALTER TABLE "group_buy_campaigns"
    ADD CONSTRAINT "group_buy_campaigns_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;

CREATE TABLE "group_buy_tiers" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_buy_tiers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "group_buy_tiers_campaign_id_min_quantity_idx" ON "group_buy_tiers"("campaign_id", "min_quantity");

ALTER TABLE "group_buy_tiers"
    ADD CONSTRAINT "group_buy_tiers_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "group_buy_campaigns"("id") ON DELETE CASCADE;

CREATE TABLE "group_buy_participations" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "reserved_price" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'JOINED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "group_buy_participations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_buy_participations_campaign_id_buyer_id_key" ON "group_buy_participations"("campaign_id", "buyer_id");
CREATE INDEX "group_buy_participations_campaign_id_created_at_idx" ON "group_buy_participations"("campaign_id", "created_at");
CREATE INDEX "group_buy_participations_buyer_id_created_at_idx" ON "group_buy_participations"("buyer_id", "created_at");

ALTER TABLE "group_buy_participations"
    ADD CONSTRAINT "group_buy_participations_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "group_buy_campaigns"("id") ON DELETE CASCADE;
ALTER TABLE "group_buy_participations"
    ADD CONSTRAINT "group_buy_participations_buyer_id_fkey"
    FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- ── Regional logistics network ─────────────────────────────────────────────

CREATE TYPE "CorridorStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

CREATE TABLE "regional_corridors" (
    "id" UUID NOT NULL,
    "corridor_code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR NOT NULL DEFAULT '',
    "origin_branch_id" UUID NOT NULL,
    "dest_branch_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "base_fee" DECIMAL(12,2) NOT NULL,
    "per_km_fee" DECIMAL(12,2) NOT NULL,
    "estimated_km" INTEGER NOT NULL,
    "estimated_hours" INTEGER NOT NULL,
    "status" "CorridorStatus" NOT NULL DEFAULT 'DRAFT',
    "activated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "regional_corridors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "regional_corridors_corridor_code_key" ON "regional_corridors"("corridor_code");
CREATE INDEX "regional_corridors_status_origin_branch_id_idx" ON "regional_corridors"("status", "origin_branch_id");
CREATE INDEX "regional_corridors_status_dest_branch_id_idx" ON "regional_corridors"("status", "dest_branch_id");

ALTER TABLE "regional_corridors"
    ADD CONSTRAINT "regional_corridors_origin_branch_id_fkey"
    FOREIGN KEY ("origin_branch_id") REFERENCES "business_branches"("id") ON DELETE CASCADE;
ALTER TABLE "regional_corridors"
    ADD CONSTRAINT "regional_corridors_dest_branch_id_fkey"
    FOREIGN KEY ("dest_branch_id") REFERENCES "business_branches"("id") ON DELETE CASCADE;

CREATE TABLE "corridor_stops" (
    "id" UUID NOT NULL,
    "corridor_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "stop_order" INTEGER NOT NULL,
    "label" VARCHAR NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corridor_stops_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "corridor_stops_corridor_id_stop_order_idx" ON "corridor_stops"("corridor_id", "stop_order");

ALTER TABLE "corridor_stops"
    ADD CONSTRAINT "corridor_stops_corridor_id_fkey"
    FOREIGN KEY ("corridor_id") REFERENCES "regional_corridors"("id") ON DELETE CASCADE;
ALTER TABLE "corridor_stops"
    ADD CONSTRAINT "corridor_stops_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "business_branches"("id") ON DELETE CASCADE;
