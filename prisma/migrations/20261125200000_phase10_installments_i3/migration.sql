-- Phase 10 I3: receipts, reminders and overdue management.

ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_RECEIPT_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_REMINDER_QUEUED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_REMINDER_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_OVERDUE_MARKED';

CREATE TYPE "InstallmentReminderType" AS ENUM ('UPCOMING', 'OVERDUE');
CREATE TYPE "InstallmentReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "installment_receipts" (
    "id" UUID NOT NULL,
    "receipt_number" VARCHAR(40) NOT NULL,
    "payment_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_receipts_number_key" UNIQUE ("receipt_number"),
    CONSTRAINT "installment_receipts_payment_key" UNIQUE ("payment_id")
);
CREATE INDEX "installment_receipts_buyer_issued_idx" ON "installment_receipts"("buyer_user_id", "issued_at");
ALTER TABLE "installment_receipts" ADD CONSTRAINT "installment_receipts_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "installment_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_receipts" ADD CONSTRAINT "installment_receipts_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_reminders" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "scope_key" VARCHAR(80) NOT NULL,
    "reminder_type" "InstallmentReminderType" NOT NULL,
    "status" "InstallmentReminderStatus" NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_reminders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_reminders_unique_scope" UNIQUE ("agreement_id", "scope_key", "reminder_type")
);
CREATE INDEX "installment_reminders_status_due_idx" ON "installment_reminders"("status", "due_at");
ALTER TABLE "installment_reminders" ADD CONSTRAINT "installment_reminders_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
