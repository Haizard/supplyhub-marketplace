-- Phase 9 L8: platform dispatch marketplace.

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_OPPORTUNITY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_OPPORTUNITY_OFFERED';
ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_OPPORTUNITY_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_OPPORTUNITY_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_OPPORTUNITY_EXPIRED';

CREATE TYPE "DeliveryOpportunityStatus" AS ENUM ('OPEN', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'CONVERTED');

CREATE TABLE "delivery_opportunities" (
    "id" UUID NOT NULL,
    "opportunity_number" VARCHAR NOT NULL,
    "request_id" UUID NOT NULL,
    "status" "DeliveryOpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "pickup_name" VARCHAR NOT NULL,
    "pickup_address" VARCHAR NOT NULL,
    "pickup_latitude" DECIMAL(10,7) NOT NULL,
    "pickup_longitude" DECIMAL(10,7) NOT NULL,
    "dropoff_name" VARCHAR NOT NULL,
    "dropoff_address" VARCHAR NOT NULL,
    "distance_km" DECIMAL(10,3) NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "required_vehicle_type" VARCHAR(32),
    "offered_to_id" UUID,
    "offered_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "decline_reason" TEXT,
    "converted_job_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "delivery_opportunities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "delivery_opportunities_number_key" ON "delivery_opportunities"("opportunity_number");
CREATE INDEX "delivery_opportunities_status_created_idx" ON "delivery_opportunities"("status", "created_at");
CREATE INDEX "delivery_opportunities_offered_status_idx" ON "delivery_opportunities"("offered_to_id", "status");
ALTER TABLE "delivery_opportunities" ADD CONSTRAINT "delivery_opportunities_request_fkey" FOREIGN KEY ("request_id") REFERENCES "delivery_requests"("id") ON DELETE CASCADE;
ALTER TABLE "delivery_opportunities" ADD CONSTRAINT "delivery_opportunities_company_fkey" FOREIGN KEY ("offered_to_id") REFERENCES "logistics_companies"("id") ON DELETE SET NULL;

CREATE TABLE "logistics_company_offer_scores" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "score" DECIMAL(8,3) NOT NULL,
    "coverage_km" DECIMAL(8,3),
    "capacity_count" INTEGER NOT NULL DEFAULT 0,
    "vehicle_match" BOOLEAN NOT NULL DEFAULT false,
    "reliability_bps" INTEGER NOT NULL DEFAULT 0,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_company_offer_scores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_company_offer_scores_opportunity_company_key" ON "logistics_company_offer_scores"("opportunity_id", "company_id");
CREATE INDEX "logistics_company_offer_scores_opportunity_rank_idx" ON "logistics_company_offer_scores"("opportunity_id", "rank");
ALTER TABLE "logistics_company_offer_scores" ADD CONSTRAINT "logistics_company_offer_scores_opportunity_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "delivery_opportunities"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_company_offer_scores" ADD CONSTRAINT "logistics_company_offer_scores_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
