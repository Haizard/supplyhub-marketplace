-- One provider application and review flow for farmers, logistics companies
-- and service studios. Approval is what verifies the entity and enables the
-- public badge.

CREATE TYPE "ProviderType" AS ENUM ('FARMER', 'LOGISTICS_COMPANY', 'SERVICE_PROVIDER');

CREATE TYPE "ProviderApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_APPLICATION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_APPLICATION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_APPLICATION_REJECTED';

CREATE TABLE "provider_applications" (
  "id" UUID NOT NULL,
  "application_number" VARCHAR(40) NOT NULL,
  "provider_type" "ProviderType" NOT NULL,
  "applicant_id" UUID NOT NULL,
  "status" "ProviderApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "display_name" VARCHAR(160) NOT NULL,
  "contact_phone" VARCHAR(40) NOT NULL,
  "contact_email" VARCHAR(160) NOT NULL,
  "district" VARCHAR(120),
  "summary" TEXT NOT NULL,
  "documents" JSONB NOT NULL,
  "farmer_id" UUID,
  "company_id" UUID,
  "vendor_id" UUID,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "review_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "provider_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_applications_application_number_key" ON "provider_applications"("application_number");
CREATE UNIQUE INDEX "provider_applications_farmer_id_key" ON "provider_applications"("farmer_id");
CREATE UNIQUE INDEX "provider_applications_company_id_key" ON "provider_applications"("company_id");
CREATE UNIQUE INDEX "provider_applications_vendor_id_key" ON "provider_applications"("vendor_id");
CREATE INDEX "provider_applications_status_submitted_at_idx" ON "provider_applications"("status", "submitted_at");
CREATE INDEX "provider_applications_applicant_id_created_at_idx" ON "provider_applications"("applicant_id", "created_at");

ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_applicant_id_fkey"
  FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_farmer_id_fkey"
  FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
