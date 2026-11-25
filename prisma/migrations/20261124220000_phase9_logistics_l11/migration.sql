-- Phase 9 L11: fleet sharing and parcel hubs.

ALTER TYPE "AuditAction" ADD VALUE 'FLEET_SHARE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'FLEET_SHARE_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'FLEET_SHARE_VEHICLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PARCEL_HUB_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'PARCEL_HANDOVER_RECORDED';

CREATE TYPE "FleetShareType" AS ENUM ('VEHICLE_LENDING', 'SUBCONTRACT_DELIVERY');
CREATE TYPE "FleetShareStatus" AS ENUM ('DRAFT', 'PENDING_PARTNER', 'ACTIVE', 'SUSPENDED', 'DECLINED', 'TERMINATED');
CREATE TYPE "FleetShareUsageStatus" AS ENUM ('RESERVED', 'IN_USE', 'RELEASED', 'CANCELLED');
CREATE TYPE "ParcelHubStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ParcelHandoverDirection" AS ENUM ('INTAKE', 'COLLECTION');
CREATE TYPE "ParcelHandoverStatus" AS ENUM ('RECEIVED', 'STORED', 'RELEASED', 'RETURNED');

CREATE TABLE "fleet_share_agreements" (
    "id" UUID NOT NULL,
    "agreement_number" VARCHAR(40) NOT NULL,
    "owner_company_id" UUID NOT NULL,
    "partner_company_id" UUID NOT NULL,
    "type" "FleetShareType" NOT NULL,
    "status" "FleetShareStatus" NOT NULL DEFAULT 'PENDING_PARTNER',
    "rate_amount" DECIMAL(12,2),
    "rate_currency" VARCHAR(3),
    "liability_terms" VARCHAR(1000),
    "insurance_policy_ref" VARCHAR(160),
    "insurance_expires_at" TIMESTAMPTZ(6),
    "accountable_company_id" UUID NOT NULL,
    "owner_consented_at" TIMESTAMPTZ(6),
    "owner_consented_by_id" UUID,
    "partner_consented_at" TIMESTAMPTZ(6),
    "partner_consented_by_id" UUID,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "suspended_at" TIMESTAMPTZ(6),
    "terminated_at" TIMESTAMPTZ(6),
    "termination_reason" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "fleet_share_agreements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fleet_share_agreements_not_self" CHECK ("owner_company_id" <> "partner_company_id"),
    CONSTRAINT "fleet_share_agreements_accountable_check" CHECK ("accountable_company_id" IN ("owner_company_id", "partner_company_id"))
);
CREATE UNIQUE INDEX "fleet_share_agreements_agreement_number_key" ON "fleet_share_agreements"("agreement_number");
CREATE INDEX "fleet_share_agreements_owner_status_idx" ON "fleet_share_agreements"("owner_company_id", "status");
CREATE INDEX "fleet_share_agreements_partner_status_idx" ON "fleet_share_agreements"("partner_company_id", "status");
ALTER TABLE "fleet_share_agreements" ADD CONSTRAINT "fleet_share_agreements_owner_fkey" FOREIGN KEY ("owner_company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "fleet_share_agreements" ADD CONSTRAINT "fleet_share_agreements_partner_fkey" FOREIGN KEY ("partner_company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "fleet_share_vehicles" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fleet_share_vehicles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fleet_share_vehicles_agreement_vehicle_key" ON "fleet_share_vehicles"("agreement_id", "vehicle_id");
CREATE INDEX "fleet_share_vehicles_vehicle_active_idx" ON "fleet_share_vehicles"("vehicle_id", "active");
ALTER TABLE "fleet_share_vehicles" ADD CONSTRAINT "fleet_share_vehicles_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "fleet_share_agreements"("id") ON DELETE CASCADE;
ALTER TABLE "fleet_share_vehicles" ADD CONSTRAINT "fleet_share_vehicles_vehicle_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "logistics_vehicles"("id") ON DELETE CASCADE;

CREATE TABLE "fleet_share_usages" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "using_company_id" UUID NOT NULL,
    "accountable_company_id" UUID NOT NULL,
    "job_id" UUID,
    "status" "FleetShareUsageStatus" NOT NULL DEFAULT 'RESERVED',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    CONSTRAINT "fleet_share_usages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fleet_share_usages_agreement_status_idx" ON "fleet_share_usages"("agreement_id", "status");
CREATE INDEX "fleet_share_usages_vehicle_status_idx" ON "fleet_share_usages"("vehicle_id", "status");
ALTER TABLE "fleet_share_usages" ADD CONSTRAINT "fleet_share_usages_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "fleet_share_agreements"("id") ON DELETE CASCADE;
ALTER TABLE "fleet_share_usages" ADD CONSTRAINT "fleet_share_usages_vehicle_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "logistics_vehicles"("id") ON DELETE CASCADE;
ALTER TABLE "fleet_share_usages" ADD CONSTRAINT "fleet_share_usages_job_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE SET NULL;

CREATE TABLE "parcel_hubs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "hub_code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "city" VARCHAR(120),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "capacity" INTEGER NOT NULL DEFAULT 50,
    "status" "ParcelHubStatus" NOT NULL DEFAULT 'ACTIVE',
    "operating_hours" JSONB,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "parcel_hubs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "parcel_hubs_capacity_positive" CHECK ("capacity" > 0)
);
CREATE UNIQUE INDEX "parcel_hubs_company_code_key" ON "parcel_hubs"("company_id", "hub_code");
CREATE INDEX "parcel_hubs_company_status_idx" ON "parcel_hubs"("company_id", "status");
ALTER TABLE "parcel_hubs" ADD CONSTRAINT "parcel_hubs_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "parcel_hub_handovers" (
    "id" UUID NOT NULL,
    "hub_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tracking_ref" VARCHAR(120) NOT NULL,
    "direction" "ParcelHandoverDirection" NOT NULL,
    "status" "ParcelHandoverStatus" NOT NULL DEFAULT 'RECEIVED',
    "job_id" UUID,
    "custodian_member_id" UUID,
    "received_by_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickup_code" VARCHAR(12) NOT NULL,
    "pickup_code_verified_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "released_to_name" VARCHAR(160),
    "released_to_phone" VARCHAR(40),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parcel_hub_handovers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "parcel_hub_handovers_hub_status_idx" ON "parcel_hub_handovers"("hub_id", "status");
CREATE INDEX "parcel_hub_handovers_company_status_idx" ON "parcel_hub_handovers"("company_id", "status");
CREATE INDEX "parcel_hub_handovers_tracking_idx" ON "parcel_hub_handovers"("tracking_ref");
ALTER TABLE "parcel_hub_handovers" ADD CONSTRAINT "parcel_hub_handovers_hub_fkey" FOREIGN KEY ("hub_id") REFERENCES "parcel_hubs"("id") ON DELETE CASCADE;
ALTER TABLE "parcel_hub_handovers" ADD CONSTRAINT "parcel_hub_handovers_job_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE SET NULL;

-- Company-scoped permission for sharing capacity and running parcel hubs.
INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES (gen_random_uuid(), 'logistics.fleet.share', 'Share fleet capacity and operate parcel hubs')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" = 'logistics.fleet.share'
ON CONFLICT DO NOTHING;
