-- Phase 10 I2: verified installment payments and allocations.

ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_PAYMENT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_PAYMENT_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_PAYMENT_REFUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_PAYMENT_MISMATCH';

CREATE TYPE "InstallmentPaymentMethod" AS ENUM ('MPESA', 'TIGOPESA', 'AIRTEL', 'HALOPESA', 'CARD', 'BANK', 'CASH');
CREATE TYPE "InstallmentPaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REFUNDED');
CREATE TYPE "InstallmentPaymentEventOutcome" AS ENUM ('APPLIED', 'DUPLICATE', 'MISMATCH', 'IGNORED', 'ERROR');

CREATE TABLE "installment_payments" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(80) NOT NULL,
    "agreement_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "method" "InstallmentPaymentMethod" NOT NULL,
    "status" "InstallmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(40),
    "provider_payment_id" VARCHAR(120),
    "provider_reference" VARCHAR(160),
    "checkout_url" VARCHAR(500),
    "paid_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "verified_by_id" UUID,
    "failure_reason" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_payments_reference_key" UNIQUE ("reference"),
    CONSTRAINT "installment_payments_provider_id_key" UNIQUE ("provider_payment_id"),
    CONSTRAINT "installment_payments_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "installment_payments_agreement_status_idx" ON "installment_payments"("agreement_id", "status");
CREATE INDEX "installment_payments_buyer_created_idx" ON "installment_payments"("buyer_user_id", "created_at");
ALTER TABLE "installment_payments" ADD CONSTRAINT "installment_payments_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "installment_agreements" ADD COLUMN "advance_credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "installment_payment_allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_payment_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_payment_allocations_unique" UNIQUE ("payment_id", "schedule_id"),
    CONSTRAINT "installment_payment_allocations_positive" CHECK ("amount" > 0)
);
CREATE INDEX "installment_payment_allocations_schedule_idx" ON "installment_payment_allocations"("schedule_id");
ALTER TABLE "installment_payment_allocations" ADD CONSTRAINT "installment_payment_allocations_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "installment_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_payment_allocations" ADD CONSTRAINT "installment_payment_allocations_schedule_fkey" FOREIGN KEY ("schedule_id") REFERENCES "installment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_payment_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "delivery_id" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "payment_id" UUID,
    "agreement_id" UUID,
    "outcome" "InstallmentPaymentEventOutcome" NOT NULL,
    "status" VARCHAR(40),
    "payload" JSONB NOT NULL,
    "error_message" VARCHAR(500),
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_payment_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_payment_events_delivery_key" UNIQUE ("provider", "delivery_id")
);
CREATE INDEX "installment_payment_events_payment_created_idx" ON "installment_payment_events"("payment_id", "created_at");
ALTER TABLE "installment_payment_events" ADD CONSTRAINT "installment_payment_events_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "installment_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
