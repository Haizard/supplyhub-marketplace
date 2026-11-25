-- Phase 10 I1: seller-funded installment sales (settings and agreements).

ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_SETTINGS_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_AGREEMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_AGREEMENT_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_AGREEMENT_CANCELLED';

CREATE TYPE "InstallmentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
CREATE TYPE "InstallmentDepositMode" AS ENUM ('FIXED', 'PERCENTAGE');
CREATE TYPE "InstallmentPossession" AS ENUM ('IMMEDIATE', 'AFTER_FULL_PAYMENT');
CREATE TYPE "InstallmentSource" AS ENUM ('MARKETPLACE', 'OFFLINE');
CREATE TYPE "InstallmentAgreementStatus" AS ENUM ('DRAFT', 'PENDING_CUSTOMER_ACCEPTANCE', 'PENDING_DEPOSIT', 'ACTIVE', 'OVERDUE', 'COMPLETED', 'DEFAULTED', 'CANCELLED', 'DISPUTED');
CREATE TYPE "InstallmentScheduleStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');

CREATE TABLE "installment_settings" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "default_deposit_mode" "InstallmentDepositMode" NOT NULL DEFAULT 'PERCENTAGE',
    "default_deposit_value" DECIMAL(12,2) NOT NULL DEFAULT 20,
    "default_frequency" "InstallmentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "default_installment_count" INTEGER NOT NULL DEFAULT 6,
    "default_possession" "InstallmentPossession" NOT NULL DEFAULT 'AFTER_FULL_PAYMENT',
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "allow_interest" BOOLEAN NOT NULL DEFAULT false,
    "interest_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "allow_late_fees" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_bps" INTEGER NOT NULL DEFAULT 0,
    "allow_advance_payments" BOOLEAN NOT NULL DEFAULT false,
    "max_installments" INTEGER NOT NULL DEFAULT 24,
    "terms_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "installment_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_settings_business_key" UNIQUE ("business_id"),
    CONSTRAINT "installment_settings_grace_nonneg" CHECK ("grace_period_days" >= 0),
    CONSTRAINT "installment_settings_max_count" CHECK ("max_installments" BETWEEN 1 AND 60)
);
ALTER TABLE "installment_settings" ADD CONSTRAINT "installment_settings_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_agreements" (
    "id" UUID NOT NULL,
    "agreement_number" VARCHAR(40) NOT NULL,
    "business_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "source" "InstallmentSource" NOT NULL,
    "order_id" UUID,
    "currency" VARCHAR(3) NOT NULL,
    "cash_price" DECIMAL(14,2) NOT NULL,
    "deposit_amount" DECIMAL(14,2) NOT NULL,
    "interest_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "extra_charges" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_payable" DECIMAL(14,2) NOT NULL,
    "outstanding_balance" DECIMAL(14,2) NOT NULL,
    "deposit_mode" "InstallmentDepositMode" NOT NULL,
    "frequency" "InstallmentFrequency" NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "installment_amount" DECIMAL(14,2) NOT NULL,
    "possession_model" "InstallmentPossession" NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "interest_policy" VARCHAR(300),
    "late_payment_policy" VARCHAR(500),
    "notes" TEXT,
    "status" "InstallmentAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "terms_snapshot" JSONB NOT NULL,
    "seller_accepted_at" TIMESTAMPTZ(6),
    "seller_accepted_by_id" UUID,
    "buyer_accepted_at" TIMESTAMPTZ(6),
    "buyer_acceptance_method" VARCHAR(60),
    "activated_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "installment_agreements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_agreements_amounts_positive" CHECK ("cash_price" > 0 AND "total_payable" >= "cash_price" AND "deposit_amount" >= 0 AND "deposit_amount" < "total_payable" AND "outstanding_balance" >= 0),
    CONSTRAINT "installment_agreements_count_positive" CHECK ("installment_count" > 0)
);
CREATE UNIQUE INDEX "installment_agreements_number_key" ON "installment_agreements"("agreement_number");
CREATE INDEX "installment_agreements_business_status_idx" ON "installment_agreements"("business_id", "status");
CREATE INDEX "installment_agreements_buyer_status_idx" ON "installment_agreements"("buyer_user_id", "status");
ALTER TABLE "installment_agreements" ADD CONSTRAINT "installment_agreements_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_agreements" ADD CONSTRAINT "installment_agreements_buyer_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "installment_agreements" ADD CONSTRAINT "installment_agreements_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "installment_agreement_items" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "product_id" UUID,
    "product_name" VARCHAR(200) NOT NULL,
    "sku" VARCHAR(80),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "installment_agreement_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_agreement_items_positive" CHECK ("quantity" > 0 AND "unit_price" >= 0)
);
CREATE INDEX "installment_agreement_items_agreement_idx" ON "installment_agreement_items"("agreement_id");
ALTER TABLE "installment_agreement_items" ADD CONSTRAINT "installment_agreement_items_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_schedules" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "InstallmentScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMPTZ(6),
    CONSTRAINT "installment_schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_schedules_unique_seq" UNIQUE ("agreement_id", "sequence"),
    CONSTRAINT "installment_schedules_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "installment_schedules_due_status_idx" ON "installment_schedules"("due_date", "status");
ALTER TABLE "installment_schedules" ADD CONSTRAINT "installment_schedules_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_agreement_events" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "from_status" VARCHAR(40),
    "to_status" VARCHAR(40),
    "actor_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_agreement_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "installment_agreement_events_agreement_created_idx" ON "installment_agreement_events"("agreement_id", "created_at");
ALTER TABLE "installment_agreement_events" ADD CONSTRAINT "installment_agreement_events_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES (gen_random_uuid(), 'installments.manage', 'Configure and manage seller installment sales')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" = 'installments.manage'
ON CONFLICT DO NOTHING;

-- Disabled by default; an administrator enables it after compliance review.
INSERT INTO "feature_flags" ("id", "key", "name", "description", "enabled", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'phase10.installmentSales', 'Installment sales',
        'Seller-funded installment agreements, schedules and collections.', false, now(), now())
ON CONFLICT ("key") DO NOTHING;
