-- Phase 11 B: agricultural inputs and service network.

ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_SUPPLIER_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_INPUT_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_SERVICE_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_BOOKING_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_INPUT_ORDER_CREATED';

CREATE TYPE "AgricultureSupplierType" AS ENUM ('INPUT', 'SERVICE', 'BOTH');
CREATE TYPE "AgriculturalInputCategory" AS ENUM ('SEED', 'FERTILIZER', 'MANURE_COMPOST', 'CROP_PROTECTION', 'ANIMAL_FEED', 'VETERINARY', 'TOOL', 'IRRIGATION', 'EQUIPMENT', 'OTHER');
CREATE TYPE "AgriculturalInputStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED');
CREATE TYPE "AgriculturalServiceType" AS ENUM ('TRACTOR', 'PLOUGHING', 'PLANTING', 'SPRAYING', 'HARVESTING', 'IRRIGATION', 'SOIL_TESTING', 'AGRONOMY', 'TRANSPORT', 'STORAGE', 'LABOUR');
CREATE TYPE "AgriculturalServiceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED');
CREATE TYPE "AgriculturalBookingStatus" AS ENUM ('REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AgriculturalInputOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED');

CREATE TABLE "agricultural_suppliers" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "type" "AgricultureSupplierType" NOT NULL,
  "verification_status" "AgricultureVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "business_name" VARCHAR(160) NOT NULL, "registration_number" VARCHAR(120), "license_reference" VARCHAR(160),
  "insurance_reference" VARCHAR(160), "phone" VARCHAR(40), "region" VARCHAR(120), "district" VARCHAR(120),
  "verified_by_id" UUID, "verified_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agricultural_suppliers_pkey" PRIMARY KEY ("id"), CONSTRAINT "agricultural_suppliers_user_key" UNIQUE ("user_id")
);
CREATE INDEX "agricultural_suppliers_verification_idx" ON "agricultural_suppliers"("verification_status", "type");
ALTER TABLE "agricultural_suppliers" ADD CONSTRAINT "agricultural_suppliers_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_inputs" (
  "id" UUID NOT NULL, "supplier_id" UUID NOT NULL, "name" VARCHAR(160) NOT NULL, "category" "AgriculturalInputCategory" NOT NULL,
  "description" TEXT, "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL,
  "price_per_unit" DECIMAL(14,2) NOT NULL, "currency" VARCHAR(3) NOT NULL, "minimum_order" DECIMAL(14,2) NOT NULL,
  "treatment_status" VARCHAR(160), "registration_ref" VARCHAR(160), "safety_notes" TEXT, "organic_claim" BOOLEAN NOT NULL DEFAULT false,
  "status" "AgriculturalInputStatus" NOT NULL DEFAULT 'DRAFT', "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agricultural_inputs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agricultural_inputs_positive" CHECK ("quantity" > 0 AND "price_per_unit" > 0 AND "minimum_order" > 0)
);
CREATE INDEX "agricultural_inputs_status_category_idx" ON "agricultural_inputs"("status", "category");
ALTER TABLE "agricultural_inputs" ADD CONSTRAINT "agricultural_inputs_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "agricultural_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_services" (
  "id" UUID NOT NULL, "supplier_id" UUID NOT NULL, "service_type" "AgriculturalServiceType" NOT NULL, "title" VARCHAR(160) NOT NULL,
  "description" TEXT, "rate_amount" DECIMAL(14,2) NOT NULL, "rate_unit" VARCHAR(40) NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "service_area" VARCHAR(200), "qualification_ref" VARCHAR(160), "status" "AgriculturalServiceStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_services_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_services_status_type_idx" ON "agricultural_services"("status", "service_type");
ALTER TABLE "agricultural_services" ADD CONSTRAINT "agricultural_services_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "agricultural_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_service_bookings" (
  "id" UUID NOT NULL, "booking_number" VARCHAR(40) NOT NULL, "service_id" UUID NOT NULL, "supplier_id" UUID NOT NULL,
  "farmer_id" UUID NOT NULL, "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "requested_for" TIMESTAMPTZ(6) NOT NULL,
  "scheduled_at" TIMESTAMPTZ(6), "quote_amount" DECIMAL(14,2), "currency" VARCHAR(3) NOT NULL, "quote_note" VARCHAR(500),
  "status" "AgriculturalBookingStatus" NOT NULL DEFAULT 'REQUESTED', "completed_at" TIMESTAMPTZ(6), "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" VARCHAR(500), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_service_bookings_pkey" PRIMARY KEY ("id"), CONSTRAINT "agricultural_service_bookings_number_key" UNIQUE ("booking_number")
);
CREATE INDEX "agricultural_service_bookings_supplier_idx" ON "agricultural_service_bookings"("supplier_id", "status", "scheduled_at");
CREATE INDEX "agricultural_service_bookings_farmer_idx" ON "agricultural_service_bookings"("farmer_id", "status");
ALTER TABLE "agricultural_service_bookings" ADD CONSTRAINT "agricultural_service_bookings_service_fkey" FOREIGN KEY ("service_id") REFERENCES "agricultural_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_service_bookings" ADD CONSTRAINT "agricultural_service_bookings_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agricultural_input_orders" (
  "id" UUID NOT NULL, "supplier_id" UUID NOT NULL, "input_id" UUID NOT NULL, "farmer_id" UUID NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL, "total" DECIMAL(14,2) NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "status" "AgriculturalInputOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT', "order_id" UUID, "terms_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agricultural_input_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agricultural_input_orders_farmer_status_idx" ON "agricultural_input_orders"("farmer_id", "status");
CREATE INDEX "agricultural_input_orders_supplier_created_idx" ON "agricultural_input_orders"("supplier_id", "created_at");
ALTER TABLE "agricultural_input_orders" ADD CONSTRAINT "agricultural_input_orders_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "agricultural_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_input_orders" ADD CONSTRAINT "agricultural_input_orders_input_fkey" FOREIGN KEY ("input_id") REFERENCES "agricultural_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_input_orders" ADD CONSTRAINT "agricultural_input_orders_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agricultural_input_orders" ADD CONSTRAINT "agricultural_input_orders_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "permission_key", "description") VALUES
  (gen_random_uuid(), 'agriculture.inputs.manage', 'Manage agricultural input catalogue and orders'),
  (gen_random_uuid(), 'agriculture.services.manage', 'Manage agricultural services and bookings')
ON CONFLICT ("permission_key") DO NOTHING;
