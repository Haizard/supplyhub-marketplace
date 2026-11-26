-- Phase 11 A: agriculture farmer profiles, farms, listings and trade.

ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_FARMER_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_LISTING_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_OFFER_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_OFFER_DECIDED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_CONTRACT_CREATED';

CREATE TYPE "AgricultureVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "AgriculturalUnit" AS ENUM ('KG', 'BAG', 'TONNE', 'CRATE', 'LITRE', 'PIECE');
CREATE TYPE "FarmSizeUnit" AS ENUM ('ACRE', 'HECTARE');
CREATE TYPE "FarmOwnership" AS ENUM ('OWNED', 'LEASED');
CREATE TYPE "AgriculturalListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SOLD', 'CANCELLED');
CREATE TYPE "AgriculturalBuyerRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "AgriculturalOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');
CREATE TYPE "AgriculturalContractStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED');

CREATE TABLE "agriculture_farmers" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "verification_status" "AgricultureVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "phone" VARCHAR(40), "region" VARCHAR(120), "district" VARCHAR(120), "ward" VARCHAR(120), "village" VARCHAR(120),
  "note" TEXT, "verified_by_id" UUID, "verified_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agriculture_farmers_pkey" PRIMARY KEY ("id"), CONSTRAINT "agriculture_farmers_user_key" UNIQUE ("user_id")
);
CREATE INDEX "agriculture_farmers_verification_idx" ON "agriculture_farmers"("verification_status", "created_at");
ALTER TABLE "agriculture_farmers" ADD CONSTRAINT "agriculture_farmers_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "farms" (
  "id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "name" VARCHAR(160) NOT NULL,
  "size_value" DECIMAL(12,2) NOT NULL, "size_unit" "FarmSizeUnit" NOT NULL, "ownership" "FarmOwnership" NOT NULL DEFAULT 'OWNED',
  "region" VARCHAR(120), "district" VARCHAR(120), "ward" VARCHAR(120), "village" VARCHAR(120),
  "water_source" VARCHAR(200), "soil_info" VARCHAR(300), "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "farms_farmer_active_idx" ON "farms"("farmer_id", "is_active");
ALTER TABLE "farms" ADD CONSTRAINT "farms_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "farm_plots" (
  "id" UUID NOT NULL, "farm_id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL,
  "size_value" DECIMAL(12,2) NOT NULL, "size_unit" "FarmSizeUnit" NOT NULL,
  "boundary_notes" VARCHAR(500), "latitude" DECIMAL(10,7), "longitude" DECIMAL(10,7), "crop_varieties" VARCHAR(300),
  "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "farm_plots_pkey" PRIMARY KEY ("id"), CONSTRAINT "farm_plots_farm_name_key" UNIQUE ("farm_id", "name")
);
ALTER TABLE "farm_plots" ADD CONSTRAINT "farm_plots_farm_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_listings" (
  "id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "buyer_user_id" UUID, "farm_id" UUID, "plot_id" UUID,
  "crop_name" VARCHAR(120) NOT NULL, "variety" VARCHAR(120), "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL,
  "price_per_unit" DECIMAL(14,2) NOT NULL, "currency" VARCHAR(3) NOT NULL, "minimum_order" DECIMAL(14,2) NOT NULL,
  "grade" VARCHAR(80), "harvest_date" TIMESTAMPTZ(6), "collection_location" VARCHAR(300) NOT NULL,
  "delivery_available" BOOLEAN NOT NULL DEFAULT false, "organic_claim" BOOLEAN NOT NULL DEFAULT false,
  "certified_claim" BOOLEAN NOT NULL DEFAULT false, "photos" JSONB, "status" "AgriculturalListingStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agricultural_listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agricultural_listings_positive" CHECK ("quantity" > 0 AND "price_per_unit" > 0 AND "minimum_order" > 0)
);
CREATE INDEX "agricultural_listings_status_crop_idx" ON "agricultural_listings"("status", "crop_name");
CREATE INDEX "agricultural_listings_farmer_created_idx" ON "agricultural_listings"("farmer_id", "created_at");
ALTER TABLE "agricultural_listings" ADD CONSTRAINT "agricultural_listings_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_listings" ADD CONSTRAINT "agricultural_listings_farm_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "agricultural_buyer_requests" (
  "id" UUID NOT NULL, "buyer_user_id" UUID NOT NULL, "product_name" VARCHAR(120) NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL, "quality_spec" TEXT,
  "delivery_location" VARCHAR(300) NOT NULL, "delivery_deadline" TIMESTAMPTZ(6) NOT NULL,
  "offer_deadline" TIMESTAMPTZ(6) NOT NULL, "status" "AgriculturalBuyerRequestStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_buyer_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_buyer_requests_status_product_idx" ON "agricultural_buyer_requests"("status", "product_name");
ALTER TABLE "agricultural_buyer_requests" ADD CONSTRAINT "agricultural_buyer_requests_user_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_offers" (
  "id" UUID NOT NULL, "request_id" UUID, "listing_id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "buyer_user_id" UUID NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL, "price_per_unit" DECIMAL(14,2) NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "note" VARCHAR(500), "status" "AgriculturalOfferStatus" NOT NULL DEFAULT 'PENDING', "decided_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_offers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_offers_farmer_status_idx" ON "agricultural_offers"("farmer_id", "status");
CREATE INDEX "agricultural_offers_buyer_status_idx" ON "agricultural_offers"("buyer_user_id", "status");
ALTER TABLE "agricultural_offers" ADD CONSTRAINT "agricultural_offers_request_fkey" FOREIGN KEY ("request_id") REFERENCES "agricultural_buyer_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agricultural_offers" ADD CONSTRAINT "agricultural_offers_listing_fkey" FOREIGN KEY ("listing_id") REFERENCES "agricultural_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_offers" ADD CONSTRAINT "agricultural_offers_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_contracts" (
  "id" UUID NOT NULL, "contract_number" VARCHAR(40) NOT NULL, "offer_id" UUID NOT NULL,
  "farmer_id" UUID NOT NULL, "buyer_user_id" UUID NOT NULL, "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL,
  "price_per_unit" DECIMAL(14,2) NOT NULL, "total" DECIMAL(14,2) NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "status" "AgriculturalContractStatus" NOT NULL DEFAULT 'PENDING_PAYMENT', "order_id" UUID, "terms_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_contracts_pkey" PRIMARY KEY ("id"), CONSTRAINT "agricultural_contracts_number_key" UNIQUE ("contract_number"), CONSTRAINT "agricultural_contracts_offer_key" UNIQUE ("offer_id")
);
CREATE INDEX "agricultural_contracts_farmer_status_idx" ON "agricultural_contracts"("farmer_id", "status");
CREATE INDEX "agricultural_contracts_buyer_status_idx" ON "agricultural_contracts"("buyer_user_id", "status");
ALTER TABLE "agricultural_contracts" ADD CONSTRAINT "agricultural_contracts_offer_fkey" FOREIGN KEY ("offer_id") REFERENCES "agricultural_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_contracts" ADD CONSTRAINT "agricultural_contracts_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_contracts" ADD CONSTRAINT "agricultural_contracts_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "permission_key", "description") VALUES
  (gen_random_uuid(), 'agriculture.farm.manage', 'Manage farms, plots and produce listings'),
  (gen_random_uuid(), 'agriculture.trade.manage', 'Manage agricultural buyer requests, offers and contracts')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "feature_flags" ("id", "key", "name", "description", "enabled", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'phase11.agricultureNetwork', 'Agriculture business network',
        'Farmer profiles, produce marketplace and agricultural trade.', false, now(), now())
ON CONFLICT ("key") DO NOTHING;
