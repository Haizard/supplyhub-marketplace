-- Phase 11 E: farmer groups and harvest purchase agreements.

ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_GROUP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_GROUP_MEMBER_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_AGREEMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_AGREEMENT_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_DELIVERY_RECORDED';

CREATE TYPE "FarmerGroupRole" AS ENUM ('COORDINATOR', 'MANAGER', 'MEMBER');
CREATE TYPE "FarmerGroupMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "HarvestAgreementStatus" AS ENUM ('DRAFT', 'PENDING_FARMER', 'ACCEPTED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

CREATE TABLE "farmer_groups" (
  "id" UUID NOT NULL, "group_code" VARCHAR(40) NOT NULL, "name" VARCHAR(160) NOT NULL,
  "registration_number" VARCHAR(120), "coordinator_id" UUID NOT NULL, "region" VARCHAR(120), "district" VARCHAR(120),
  "description" TEXT, "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "farmer_groups_pkey" PRIMARY KEY ("id"), CONSTRAINT "farmer_groups_code_key" UNIQUE ("group_code")
);
CREATE INDEX "farmer_groups_coordinator_idx" ON "farmer_groups"("coordinator_id", "is_active");
ALTER TABLE "farmer_groups" ADD CONSTRAINT "farmer_groups_coordinator_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "agriculture_farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "farmer_group_members" (
  "id" UUID NOT NULL, "group_id" UUID NOT NULL, "farmer_id" UUID NOT NULL,
  "role" "FarmerGroupRole" NOT NULL DEFAULT 'MEMBER', "status" "FarmerGroupMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "farmer_group_members_pkey" PRIMARY KEY ("id"), CONSTRAINT "farmer_group_members_unique" UNIQUE ("group_id", "farmer_id")
);
CREATE INDEX "farmer_group_members_farmer_idx" ON "farmer_group_members"("farmer_id", "status");
ALTER TABLE "farmer_group_members" ADD CONSTRAINT "farmer_group_members_group_fkey" FOREIGN KEY ("group_id") REFERENCES "farmer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "farmer_group_members" ADD CONSTRAINT "farmer_group_members_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "harvest_purchase_agreements" (
  "id" UUID NOT NULL, "agreement_number" VARCHAR(40) NOT NULL, "buyer_user_id" UUID NOT NULL,
  "farmer_id" UUID, "group_id" UUID, "crop_name" VARCHAR(120) NOT NULL, "variety" VARCHAR(120),
  "expected_quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL, "quality_spec" TEXT,
  "price_per_unit" DECIMAL(14,2), "pricing_formula" VARCHAR(300), "estimated_total" DECIMAL(14,2), "currency" VARCHAR(3) NOT NULL,
  "delivery_date" TIMESTAMPTZ(6) NOT NULL, "collection_location" VARCHAR(300) NOT NULL, "payment_terms" TEXT NOT NULL,
  "variance_policy" TEXT, "status" "HarvestAgreementStatus" NOT NULL DEFAULT 'DRAFT', "terms_snapshot" JSONB NOT NULL,
  "order_id" UUID, "buyer_accepted_at" TIMESTAMPTZ(6), "farmer_accepted_at" TIMESTAMPTZ(6),
  "delivered_at" TIMESTAMPTZ(6), "completed_at" TIMESTAMPTZ(6), "cancelled_at" TIMESTAMPTZ(6),
  "created_by_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "harvest_purchase_agreements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "harvest_purchase_agreements_number_key" UNIQUE ("agreement_number"),
  CONSTRAINT "harvest_purchase_agreements_quantity_check" CHECK ("expected_quantity" > 0)
);
CREATE INDEX "harvest_purchase_agreements_buyer_status_idx" ON "harvest_purchase_agreements"("buyer_user_id", "status");
CREATE INDEX "harvest_purchase_agreements_farmer_status_idx" ON "harvest_purchase_agreements"("farmer_id", "status");
CREATE INDEX "harvest_purchase_agreements_group_status_idx" ON "harvest_purchase_agreements"("group_id", "status");
ALTER TABLE "harvest_purchase_agreements" ADD CONSTRAINT "harvest_purchase_agreements_buyer_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "harvest_purchase_agreements" ADD CONSTRAINT "harvest_purchase_agreements_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "harvest_purchase_agreements" ADD CONSTRAINT "harvest_purchase_agreements_group_fkey" FOREIGN KEY ("group_id") REFERENCES "farmer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "harvest_purchase_agreements" ADD CONSTRAINT "harvest_purchase_agreements_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "harvest_delivery_records" (
  "id" UUID NOT NULL, "agreement_id" UUID NOT NULL, "delivered_quantity" DECIMAL(14,2) NOT NULL,
  "accepted_quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL, "grade" VARCHAR(80),
  "variance_kg" DECIMAL(14,2) NOT NULL, "note" TEXT, "recorded_by_id" UUID NOT NULL,
  "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "harvest_delivery_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "harvest_delivery_records_agreement_date_idx" ON "harvest_delivery_records"("agreement_id", "delivered_at");
ALTER TABLE "harvest_delivery_records" ADD CONSTRAINT "harvest_delivery_records_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "harvest_purchase_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
