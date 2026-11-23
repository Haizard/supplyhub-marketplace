-- Phase 6: vendor-scoped CRM and account-backed loyalty ledger.

CREATE TYPE "CustomerSegment" AS ENUM ('NEW', 'RETURNING', 'VIP');
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');
CREATE TYPE "LoyaltyTransactionType" AS ENUM (
    'EARNED_PURCHASE', 'REDEEMED_REWARD', 'ADJUSTMENT', 'REFUND_REVERSAL'
);

ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOYALTY_ACCOUNT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOYALTY_POINTS_EARNED';
ALTER TYPE "AuditAction" ADD VALUE 'LOYALTY_POINTS_REDEEMED';

CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "segment" "CustomerSegment" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loyalty_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loyalty_transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reference_type" VARCHAR(40),
    "reference_id" VARCHAR(64),
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_vendor_id_user_id_key" ON "customers"("vendor_id", "user_id");
CREATE INDEX "customers_vendor_id_segment_idx" ON "customers"("vendor_id", "segment");
CREATE UNIQUE INDEX "loyalty_accounts_user_id_key" ON "loyalty_accounts"("user_id");
CREATE UNIQUE INDEX "loyalty_transactions_reference_type_reference_id_type_key"
    ON "loyalty_transactions"("reference_type", "reference_id", "type");
CREATE INDEX "loyalty_transactions_account_id_created_at_idx"
    ON "loyalty_transactions"("account_id", "created_at");

ALTER TABLE "customers" ADD CONSTRAINT "customers_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES
  (gen_random_uuid(), 'crm.read', 'View studio customer records'),
  (gen_random_uuid(), 'crm.manage', 'Edit studio customer notes and segments')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" IN ('crm.read', 'crm.manage')
ON CONFLICT DO NOTHING;
