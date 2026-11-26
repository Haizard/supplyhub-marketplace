-- Phase 9 L3: fleet, vehicles and driver operations.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_FLEET_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_VEHICLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_VEHICLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_VEHICLE_DOCUMENT_REVIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_VEHICLE_MAINTENANCE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_PROFILE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_MEMBERSHIP_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_EMPLOYMENT_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_SCHEDULE_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_VEHICLE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_VEHICLE_RELEASED';

-- Trucks are valid in the legacy agent vehicle model too.
ALTER TYPE "DeliveryVehicleType" ADD VALUE IF NOT EXISTS 'TRUCK';

CREATE TYPE "LogisticsVehicleType" AS ENUM ('BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK');
CREATE TYPE "VehicleOwnership" AS ENUM ('OWNED', 'LEASED', 'RENTED');
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'RETIRED');
CREATE TYPE "VehicleDocumentType" AS ENUM ('REGISTRATION', 'INSURANCE', 'INSPECTION', 'OTHER');
CREATE TYPE "DriverProfileStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "DriverMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'CONTRACTOR');
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "logistics_fleets" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_fleets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_fleets_company_name_key" ON "logistics_fleets"("company_id", "name");
ALTER TABLE "logistics_fleets" ADD CONSTRAINT "logistics_fleets_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_vehicles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "fleet_id" UUID,
    "plate" VARCHAR(40) NOT NULL,
    "type" "LogisticsVehicleType" NOT NULL,
    "make" VARCHAR(80),
    "model" VARCHAR(80),
    "capacity_kg" DECIMAL(10,2),
    "ownership" "VehicleOwnership" NOT NULL DEFAULT 'OWNED',
    "lease_provider" VARCHAR(160),
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "insurance_expires_at" TIMESTAMPTZ(6),
    "inspection_expires_at" TIMESTAMPTZ(6),
    "acquired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_vehicles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_vehicles_company_plate_key" ON "logistics_vehicles"("company_id", "plate");
CREATE INDEX "logistics_vehicles_company_status_idx" ON "logistics_vehicles"("company_id", "status");
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_fleet_fkey" FOREIGN KEY ("fleet_id") REFERENCES "logistics_fleets"("id") ON DELETE SET NULL;

CREATE TABLE "vehicle_documents" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "type" "VehicleDocumentType" NOT NULL,
    "reference" VARCHAR(160),
    "storage_key" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "status" "VerificationState" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vehicle_documents_vehicle_type_idx" ON "vehicle_documents"("vehicle_id", "type");
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "logistics_vehicles"("id") ON DELETE CASCADE;

CREATE TABLE "vehicle_maintenance" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "odometer_km" INTEGER,
    "cost" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "description" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_maintenance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vehicle_maintenance_vehicle_performed_idx" ON "vehicle_maintenance"("vehicle_id", "performed_at");
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicle_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "logistics_vehicles"("id") ON DELETE CASCADE;

CREATE TABLE "driver_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "delivery_agent_id" UUID,
    "full_name" VARCHAR NOT NULL,
    "phone" VARCHAR(40),
    "license_number" VARCHAR(80),
    "license_expires_at" TIMESTAMPTZ(6),
    "status" "DriverProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 5,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_profiles_user_key" ON "driver_profiles"("user_id");
CREATE UNIQUE INDEX "driver_profiles_agent_key" ON "driver_profiles"("delivery_agent_id");
CREATE INDEX "driver_profiles_status_idx" ON "driver_profiles"("status");
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_agent_fkey" FOREIGN KEY ("delivery_agent_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL;

CREATE TABLE "driver_company_memberships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "status" "DriverMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "driver_company_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_memberships_company_driver_key" ON "driver_company_memberships"("company_id", "driver_id");
CREATE INDEX "driver_memberships_company_status_idx" ON "driver_company_memberships"("company_id", "status");
ALTER TABLE "driver_company_memberships" ADD CONSTRAINT "driver_memberships_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "driver_company_memberships" ADD CONSTRAINT "driver_memberships_driver_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE;

CREATE TABLE "driver_employment_records" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "type" "EmploymentType" NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6),
    "mode" VARCHAR(40) NOT NULL,
    "amount" DECIMAL(12,2),
    "rate_bps" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "driver_employment_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_employment_membership_key" ON "driver_employment_records"("membership_id");
ALTER TABLE "driver_employment_records" ADD CONSTRAINT "driver_employment_membership_fkey" FOREIGN KEY ("membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE CASCADE;

CREATE TABLE "driver_schedules" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "driver_schedules_membership_day_idx" ON "driver_schedules"("membership_id", "day_of_week");
ALTER TABLE "driver_schedules" ADD CONSTRAINT "driver_schedules_membership_fkey" FOREIGN KEY ("membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE CASCADE;

CREATE TABLE "driver_vehicle_assignments" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_vehicle_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "driver_assignments_membership_status_idx" ON "driver_vehicle_assignments"("membership_id", "status");
CREATE INDEX "driver_assignments_vehicle_status_idx" ON "driver_vehicle_assignments"("vehicle_id", "status");
ALTER TABLE "driver_vehicle_assignments" ADD CONSTRAINT "driver_assignments_membership_fkey" FOREIGN KEY ("membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE CASCADE;
ALTER TABLE "driver_vehicle_assignments" ADD CONSTRAINT "driver_assignments_vehicle_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "logistics_vehicles"("id") ON DELETE CASCADE;
