-- Phase 9 L2: company profile, branches and settings.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_BRANCH_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_BRANCH_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_SETTINGS_UPDATED';

CREATE TABLE "logistics_branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,
    "branch_code" VARCHAR(40) NOT NULL,
    "address" VARCHAR(300),
    "city" VARCHAR(120),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_branches_company_code_key" ON "logistics_branches"("company_id", "branch_code");
CREATE INDEX "logistics_branches_company_active_idx" ON "logistics_branches"("company_id", "is_active");
ALTER TABLE "logistics_branches" ADD CONSTRAINT "logistics_branches_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_company_settings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "notification_email" VARCHAR(160),
    "default_service_radius" DECIMAL(8,3) NOT NULL DEFAULT 15,
    "settings_json" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_company_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_company_settings_company_key" ON "logistics_company_settings"("company_id");
ALTER TABLE "logistics_company_settings" ADD CONSTRAINT "logistics_company_settings_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
EOF
npx prisma generate 2>&1 | tail -4