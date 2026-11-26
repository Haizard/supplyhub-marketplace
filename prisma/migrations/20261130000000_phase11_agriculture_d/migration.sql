-- Phase 11 D: agricultural logistics, collection centres and storage.

ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_CENTRE_REGISTERED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_STORAGE_REGISTERED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_DELIVERY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_INTAKE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_STORAGE_BOOKING_CHANGED';

CREATE TYPE "AgriculturalCargoType" AS ENUM ('PRODUCE', 'INPUT', 'MANURE');
CREATE TYPE "AgriculturalDeliveryDirection" AS ENUM ('FARM_TO_BUYER', 'FARM_TO_CENTRE', 'CENTRE_TO_BUYER', 'INPUT_TO_FARM');
CREATE TYPE "AgriculturalIntakeStatus" AS ENUM ('RECEIVED', 'GRADED', 'REJECTED', 'ACCEPTED');
CREATE TYPE "AgriculturalStorageStatus" AS ENUM ('HELD', 'STORED', 'RELEASED');

CREATE TABLE "agricultural_collection_centres" (
  "id" UUID NOT NULL, "operator_farmer_id" UUID NOT NULL, "name" VARCHAR(160) NOT NULL,
  "location" VARCHAR(300) NOT NULL, "region" VARCHAR(120), "district" VARCHAR(120),
  "capacity_kg" DECIMAL(14,2) NOT NULL, "services" JSONB, "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_collection_centres_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_collection_centres_operator_idx" ON "agricultural_collection_centres"("operator_farmer_id", "is_active");
ALTER TABLE "agricultural_collection_centres" ADD CONSTRAINT "agricultural_collection_centres_operator_fkey" FOREIGN KEY ("operator_farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_storage_facilities" (
  "id" UUID NOT NULL, "supplier_id" UUID NOT NULL, "name" VARCHAR(160) NOT NULL, "location" VARCHAR(300) NOT NULL,
  "capacity_kg" DECIMAL(14,2) NOT NULL, "cold_chain" BOOLEAN NOT NULL DEFAULT false, "rate_amount" DECIMAL(14,2) NOT NULL,
  "rate_unit" VARCHAR(40) NOT NULL, "currency" VARCHAR(3) NOT NULL, "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_storage_facilities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_storage_facilities_supplier_idx" ON "agricultural_storage_facilities"("supplier_id", "is_active");
ALTER TABLE "agricultural_storage_facilities" ADD CONSTRAINT "agricultural_storage_facilities_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "agricultural_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_deliveries" (
  "id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "request_id" UUID NOT NULL, "cargo_type" "AgriculturalCargoType" NOT NULL,
  "direction" "AgriculturalDeliveryDirection" NOT NULL, "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL,
  "centre_id" UUID, "facility_id" UUID, "note" TEXT, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_deliveries_pkey" PRIMARY KEY ("id"), CONSTRAINT "agricultural_deliveries_request_key" UNIQUE ("request_id")
);
CREATE INDEX "agricultural_deliveries_farmer_created_idx" ON "agricultural_deliveries"("farmer_id", "created_at");
ALTER TABLE "agricultural_deliveries" ADD CONSTRAINT "agricultural_deliveries_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_deliveries" ADD CONSTRAINT "agricultural_deliveries_request_fkey" FOREIGN KEY ("request_id") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_deliveries" ADD CONSTRAINT "agricultural_deliveries_centre_fkey" FOREIGN KEY ("centre_id") REFERENCES "agricultural_collection_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agricultural_deliveries" ADD CONSTRAINT "agricultural_deliveries_facility_fkey" FOREIGN KEY ("facility_id") REFERENCES "agricultural_storage_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "agricultural_intake_records" (
  "id" UUID NOT NULL, "centre_id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "harvest_batch_id" UUID,
  "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "weighed_kg" DECIMAL(14,2) NOT NULL,
  "grade" VARCHAR(80), "moisture_percent" DECIMAL(6,2), "rejected_kg" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "AgriculturalIntakeStatus" NOT NULL DEFAULT 'RECEIVED', "evidence_note" TEXT, "inspected_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_intake_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_intake_records_centre_date_idx" ON "agricultural_intake_records"("centre_id", "delivered_at");
CREATE INDEX "agricultural_intake_records_farmer_status_idx" ON "agricultural_intake_records"("farmer_id", "status");
ALTER TABLE "agricultural_intake_records" ADD CONSTRAINT "agricultural_intake_records_centre_fkey" FOREIGN KEY ("centre_id") REFERENCES "agricultural_collection_centres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_intake_records" ADD CONSTRAINT "agricultural_intake_records_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_intake_records" ADD CONSTRAINT "agricultural_intake_records_batch_fkey" FOREIGN KEY ("harvest_batch_id") REFERENCES "harvest_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "agricultural_storage_bookings" (
  "id" UUID NOT NULL, "facility_id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "quantity_kg" DECIMAL(14,2) NOT NULL,
  "status" "AgriculturalStorageStatus" NOT NULL DEFAULT 'HELD', "stored_at" TIMESTAMPTZ(6), "released_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_storage_bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_storage_bookings_facility_status_idx" ON "agricultural_storage_bookings"("facility_id", "status");
CREATE INDEX "agricultural_storage_bookings_farmer_status_idx" ON "agricultural_storage_bookings"("farmer_id", "status");
ALTER TABLE "agricultural_storage_bookings" ADD CONSTRAINT "agricultural_storage_bookings_facility_fkey" FOREIGN KEY ("facility_id") REFERENCES "agricultural_storage_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_storage_bookings" ADD CONSTRAINT "agricultural_storage_bookings_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
