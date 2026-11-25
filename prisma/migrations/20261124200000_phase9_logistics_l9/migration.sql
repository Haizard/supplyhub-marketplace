-- Phase 9 L9: partner growth network.

ALTER TYPE "AuditAction" ADD VALUE 'PARTNER_REFERRAL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PARTNER_REFERRAL_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PARTNER_REWARD_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PARTNER_REWARD_STATUS_CHANGED';

CREATE TYPE "ReferralStatus" AS ENUM ('ACTIVE', 'REGISTERED', 'VERIFIED', 'QUALIFIED', 'REJECTED');
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'PAID', 'INELIGIBLE');

CREATE TABLE "partner_referrals" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "company_id" UUID NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "link_path" VARCHAR(255) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'ACTIVE',
    "client_id" UUID,
    "registered_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "qualified_at" TIMESTAMPTZ(6),
    "rejected_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "partner_referrals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_referrals_code_key" ON "partner_referrals"("code");
CREATE UNIQUE INDEX "partner_referrals_client_key" ON "partner_referrals"("client_id");
CREATE INDEX "partner_referrals_company_status_idx" ON "partner_referrals"("company_id", "status");
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_client_fkey" FOREIGN KEY ("client_id") REFERENCES "logistics_clients"("id") ON DELETE SET NULL;

CREATE TABLE "partner_rewards" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "points" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "eligible_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "reference" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "partner_rewards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_rewards_reference_key" ON "partner_rewards"("reference");
CREATE INDEX "partner_rewards_company_status_idx" ON "partner_rewards"("company_id", "status");
CREATE INDEX "partner_rewards_referral_kind_idx" ON "partner_rewards"("referral_id", "kind");
ALTER TABLE "partner_rewards" ADD CONSTRAINT "partner_rewards_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "partner_rewards" ADD CONSTRAINT "partner_rewards_referral_fkey" FOREIGN KEY ("referral_id") REFERENCES "partner_referrals"("id") ON DELETE CASCADE;

CREATE TABLE "partner_reward_transactions" (
    "id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "amount" DECIMAL(12,2),
    "points" INTEGER NOT NULL DEFAULT 0,
    "reference" VARCHAR(120),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_reward_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_reward_transactions_reference_key" ON "partner_reward_transactions"("reference");
CREATE INDEX "partner_reward_transactions_reward_created_idx" ON "partner_reward_transactions"("reward_id", "created_at");
ALTER TABLE "partner_reward_transactions" ADD CONSTRAINT "partner_reward_transactions_reward_fkey" FOREIGN KEY ("reward_id") REFERENCES "partner_rewards"("id") ON DELETE CASCADE;
EOF
npx prisma generate 2>&1 | tail -8