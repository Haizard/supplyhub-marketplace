-- Phase 9 L1: logistics company identity, memberships and roles.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_REGISTERED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_MEMBER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_MEMBER_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_ROLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_ROLE_ASSIGNED';

CREATE TYPE "LogisticsCompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "LogisticsMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

CREATE TABLE "logistics_companies" (
    "id" UUID NOT NULL,
    "company_code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "registration_number" VARCHAR(80),
    "description" TEXT,
    "contact_phone" VARCHAR(40),
    "contact_email" VARCHAR(160),
    "address" VARCHAR(300),
    "city" VARCHAR(120),
    "country_code" VARCHAR(2) NOT NULL DEFAULT 'TZ',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "LogisticsCompanyStatus" NOT NULL DEFAULT 'PENDING',
    "business_id" UUID,
    "plan" VARCHAR(40) NOT NULL DEFAULT 'starter',
    "settings_json" JSONB,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_companies_code_key" ON "logistics_companies"("company_code");
CREATE UNIQUE INDEX "logistics_companies_slug_key" ON "logistics_companies"("slug");
CREATE INDEX "logistics_companies_status_created_idx" ON "logistics_companies"("status", "created_at");
ALTER TABLE "logistics_companies" ADD CONSTRAINT "logistics_companies_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL;
ALTER TABLE "logistics_companies" ADD CONSTRAINT "logistics_companies_reviewer_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE "logistics_company_members" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "LogisticsMemberStatus" NOT NULL DEFAULT 'INVITED',
    "invited_by_id" UUID,
    "joined_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_company_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_company_members_company_user_key" ON "logistics_company_members"("company_id", "user_id");
CREATE INDEX "logistics_company_members_company_status_idx" ON "logistics_company_members"("company_id", "status");
ALTER TABLE "logistics_company_members" ADD CONSTRAINT "lcm_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_company_members" ADD CONSTRAINT "lcm_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "logistics_company_members" ADD CONSTRAINT "lcm_inviter_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE "logistics_company_roles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_company_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_company_roles_company_name_key" ON "logistics_company_roles"("company_id", "name");
ALTER TABLE "logistics_company_roles" ADD CONSTRAINT "lcr_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_member_roles" (
    "member_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    CONSTRAINT "logistics_member_roles_pkey" PRIMARY KEY ("member_id", "role_id")
);
ALTER TABLE "logistics_member_roles" ADD CONSTRAINT "lmr_member_fkey" FOREIGN KEY ("member_id") REFERENCES "logistics_company_members"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_member_roles" ADD CONSTRAINT "lmr_role_fkey" FOREIGN KEY ("role_id") REFERENCES "logistics_company_roles"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    CONSTRAINT "logistics_role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
ALTER TABLE "logistics_role_permissions" ADD CONSTRAINT "lrp_role_fkey" FOREIGN KEY ("role_id") REFERENCES "logistics_company_roles"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_role_permissions" ADD CONSTRAINT "lrp_permission_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE;

-- Company-scoped permission keys. The global Permission table remains the single
-- vocabulary; company roles link to it through logistics_role_permissions.
INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES
  (gen_random_uuid(), 'logistics.company.read', 'View the logistics company workspace'),
  (gen_random_uuid(), 'logistics.company.update', 'Edit the logistics company profile'),
  (gen_random_uuid(), 'logistics.fleet.manage', 'Manage company vehicles and maintenance'),
  (gen_random_uuid(), 'logistics.driver.manage', 'Manage driver memberships and assignments'),
  (gen_random_uuid(), 'logistics.driver.view', 'View assigned deliveries and driver records'),
  (gen_random_uuid(), 'logistics.dispatch.manage', 'Dispatch and reassign company deliveries'),
  (gen_random_uuid(), 'logistics.client.manage', 'Manage merchant clients'),
  (gen_random_uuid(), 'logistics.contract.manage', 'Manage contracts and pricing'),
  (gen_random_uuid(), 'logistics.finance.read', 'View company financial records'),
  (gen_random_uuid(), 'logistics.finance.approve', 'Approve company payouts and invoices'),
  (gen_random_uuid(), 'logistics.referral.manage', 'Manage partner referrals and rewards')
ON CONFLICT ("permission_key") DO NOTHING;

-- Platform admins and existing business owners receive the vocabulary through their
-- wildcard/system roles; company owners get all keys when their company is created.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" LIKE 'logistics.%'
ON CONFLICT DO NOTHING;
EOF
echo "migration written"