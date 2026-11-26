-- Phase 11 C: farm management and production costing.

ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_CROP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_EXPENSE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_HARVEST_RECORDED';

CREATE TYPE "FarmCropStatus" AS ENUM ('PLANNED', 'PLANTED', 'GROWING', 'HARVESTED', 'CANCELLED');
CREATE TYPE "CropActivityType" AS ENUM ('PLANTING', 'FERTILIZING', 'SPRAYING', 'IRRIGATION', 'HARVEST', 'OTHER');
CREATE TYPE "FarmExpenseCategory" AS ENUM ('SEED', 'FERTILIZER', 'MANURE', 'LABOUR', 'TRANSPORT', 'IRRIGATION', 'PEST_CONTROL', 'OTHER');

CREATE TABLE "farm_crops" (
  "id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "farm_id" UUID NOT NULL, "plot_id" UUID,
  "crop_name" VARCHAR(120) NOT NULL, "variety" VARCHAR(120), "seed_quantity" DECIMAL(14,2), "seed_unit" "AgriculturalUnit",
  "planted_at" TIMESTAMPTZ(6), "expected_harvest_at" TIMESTAMPTZ(6), "expected_production" DECIMAL(14,2),
  "status" "FarmCropStatus" NOT NULL DEFAULT 'PLANNED', "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "farm_crops_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "farm_crops_farmer_status_idx" ON "farm_crops"("farmer_id", "status");
CREATE INDEX "farm_crops_farm_created_idx" ON "farm_crops"("farm_id", "created_at");
ALTER TABLE "farm_crops" ADD CONSTRAINT "farm_crops_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "farm_crops" ADD CONSTRAINT "farm_crops_farm_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "farm_crops" ADD CONSTRAINT "farm_crops_plot_fkey" FOREIGN KEY ("plot_id") REFERENCES "farm_plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "crop_activities" (
  "id" UUID NOT NULL, "crop_id" UUID NOT NULL, "type" "CropActivityType" NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL, "note" TEXT, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crop_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crop_activities_crop_date_idx" ON "crop_activities"("crop_id", "occurred_at");
ALTER TABLE "crop_activities" ADD CONSTRAINT "crop_activities_crop_fkey" FOREIGN KEY ("crop_id") REFERENCES "farm_crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "farm_expenses" (
  "id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "crop_id" UUID, "category" "FarmExpenseCategory" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, "currency" VARCHAR(3) NOT NULL, "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "note" VARCHAR(500), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "farm_expenses_pkey" PRIMARY KEY ("id"), CONSTRAINT "farm_expenses_positive" CHECK ("amount" > 0)
);
CREATE INDEX "farm_expenses_farmer_date_idx" ON "farm_expenses"("farmer_id", "occurred_at");
CREATE INDEX "farm_expenses_crop_category_idx" ON "farm_expenses"("crop_id", "category");
ALTER TABLE "farm_expenses" ADD CONSTRAINT "farm_expenses_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "farm_expenses" ADD CONSTRAINT "farm_expenses_crop_fkey" FOREIGN KEY ("crop_id") REFERENCES "farm_crops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "harvest_batches" (
  "id" UUID NOT NULL, "crop_id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "harvested_at" TIMESTAMPTZ(6) NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL, "unit" "AgriculturalUnit" NOT NULL, "grade" VARCHAR(80),
  "storage_location" VARCHAR(200), "note" TEXT, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "harvest_batches_pkey" PRIMARY KEY ("id"), CONSTRAINT "harvest_batches_positive" CHECK ("quantity" > 0)
);
CREATE INDEX "harvest_batches_crop_date_idx" ON "harvest_batches"("crop_id", "harvested_at");
CREATE INDEX "harvest_batches_farmer_created_idx" ON "harvest_batches"("farmer_id", "created_at");
ALTER TABLE "harvest_batches" ADD CONSTRAINT "harvest_batches_crop_fkey" FOREIGN KEY ("crop_id") REFERENCES "farm_crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "harvest_batches" ADD CONSTRAINT "harvest_batches_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
