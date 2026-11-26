-- Phase 9 L7: company financials and driver compensation.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_COMPENSATION_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_EARNING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_EARNING_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_PAYOUT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_DRIVER_PAYOUT_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_EXPENSE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_SETTLEMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_SETTLEMENT_RECONCILED';

CREATE TYPE "DriverCompensationMode" AS ENUM ('FIXED_MONTHLY', 'PER_DELIVERY', 'PERCENTAGE', 'DAILY', 'HYBRID');
CREATE TYPE "DriverEarningStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');
CREATE TYPE "DriverPayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'FAILED');
CREATE TYPE "LogisticsExpenseCategory" AS ENUM ('FUEL', 'MAINTENANCE', 'INSURANCE', 'SALARY', 'RENT', 'UTILITIES', 'PLATFORM_FEE', 'OTHER');
CREATE TYPE "LogisticsSettlementStatus" AS ENUM ('DRAFT', 'RECONCILED', 'DISPUTED');

CREATE TABLE "driver_compensation_rules" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "mode" "DriverCompensationMode" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "fixed_amount" DECIMAL(12,2),
    "per_delivery" DECIMAL(12,2),
    "rate_bps" INTEGER,
    "daily_amount" DECIMAL(12,2),
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "driver_compensation_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_compensation_rules_membership_key" ON "driver_compensation_rules"("membership_id");
ALTER TABLE "driver_compensation_rules" ADD CONSTRAINT "driver_compensation_rules_membership_fkey" FOREIGN KEY ("membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE CASCADE;

CREATE TABLE "driver_earnings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "job_id" UUID,
    "basis" VARCHAR(40) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "status" "DriverEarningStatus" NOT NULL DEFAULT 'PENDING',
    "rule_version" VARCHAR(40),
    "note" TEXT,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_earnings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_earnings_job_key" ON "driver_earnings"("job_id");
CREATE INDEX "driver_earnings_company_status_idx" ON "driver_earnings"("company_id", "status");
CREATE INDEX "driver_earnings_membership_status_idx" ON "driver_earnings"("membership_id", "status");
ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_membership_fkey" FOREIGN KEY ("membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE CASCADE;

CREATE TABLE "driver_payouts" (
    "id" UUID NOT NULL,
    "payout_number" VARCHAR NOT NULL,
    "company_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" "DriverPayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "reference" VARCHAR(120),
    "payment_proof" VARCHAR(255),
    "note" TEXT,
    "created_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "failed_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "driver_payouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_payouts_number_key" ON "driver_payouts"("payout_number");
CREATE INDEX "driver_payouts_company_status_idx" ON "driver_payouts"("company_id", "status");
CREATE INDEX "driver_payouts_membership_status_idx" ON "driver_payouts"("membership_id", "status");
ALTER TABLE "driver_payouts" ADD CONSTRAINT "driver_payouts_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "driver_payouts" ADD CONSTRAINT "driver_payouts_membership_fkey" FOREIGN KEY ("membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_expenses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "category" "LogisticsExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "reference" VARCHAR(120),
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "logistics_expenses_company_occurred_idx" ON "logistics_expenses"("company_id", "occurred_at");
CREATE INDEX "logistics_expenses_company_category_idx" ON "logistics_expenses"("company_id", "category");
ALTER TABLE "logistics_expenses" ADD CONSTRAINT "logistics_expenses_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_expenses" ADD CONSTRAINT "logistics_expenses_vehicle_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "logistics_vehicles"("id") ON DELETE SET NULL;

CREATE TABLE "logistics_settlements" (
    "id" UUID NOT NULL,
    "settlement_number" VARCHAR NOT NULL,
    "company_id" UUID NOT NULL,
    "status" "LogisticsSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "revenue" DECIMAL(12,2) NOT NULL,
    "platform_fees" DECIMAL(12,2) NOT NULL,
    "driver_costs" DECIMAL(12,2) NOT NULL,
    "expenses" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "reconciled_by_id" UUID,
    "reconciled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_settlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_settlements_number_key" ON "logistics_settlements"("settlement_number");
CREATE INDEX "logistics_settlements_company_created_idx" ON "logistics_settlements"("company_id", "created_at");
ALTER TABLE "logistics_settlements" ADD CONSTRAINT "logistics_settlements_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
