-- Phase 10 I5: installment disputes and reconciliation.

ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_DISPUTE_OPENED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_DISPUTE_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_RECONCILIATION_COMPLETED';

CREATE TYPE "InstallmentDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "InstallmentReconciliationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "installment_disputes" (
    "id" UUID NOT NULL,
    "dispute_number" VARCHAR(40) NOT NULL,
    "agreement_id" UUID NOT NULL,
    "payment_id" UUID,
    "opened_by_id" UUID NOT NULL,
    "opened_by_role" VARCHAR(20) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "InstallmentDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_disputes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_disputes_number_key" UNIQUE ("dispute_number")
);
CREATE INDEX "installment_disputes_agreement_status_idx" ON "installment_disputes"("agreement_id", "status");
ALTER TABLE "installment_disputes" ADD CONSTRAINT "installment_disputes_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_disputes" ADD CONSTRAINT "installment_disputes_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "installment_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "installment_disputes" ADD CONSTRAINT "installment_disputes_opener_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "installment_reconciliation_runs" (
    "id" UUID NOT NULL,
    "run_number" VARCHAR(40) NOT NULL,
    "business_id" UUID NOT NULL,
    "status" "InstallmentReconciliationStatus" NOT NULL DEFAULT 'RUNNING',
    "checked_count" INTEGER NOT NULL DEFAULT 0,
    "finding_count" INTEGER NOT NULL DEFAULT 0,
    "initiated_by_id" UUID,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_reconciliation_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_reconciliation_runs_number_key" UNIQUE ("run_number")
);
CREATE INDEX "installment_reconciliation_runs_business_created_idx" ON "installment_reconciliation_runs"("business_id", "created_at");
ALTER TABLE "installment_reconciliation_runs" ADD CONSTRAINT "installment_reconciliation_runs_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_reconciliation_findings" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "installment_payment_id" UUID,
    "severity" "FindingSeverity" NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "message" TEXT NOT NULL,
    "expected" VARCHAR(80),
    "actual" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_reconciliation_findings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "installment_reconciliation_findings_run_severity_idx" ON "installment_reconciliation_findings"("run_id", "severity");
ALTER TABLE "installment_reconciliation_findings" ADD CONSTRAINT "installment_reconciliation_findings_run_fkey" FOREIGN KEY ("run_id") REFERENCES "installment_reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_reconciliation_findings" ADD CONSTRAINT "installment_reconciliation_findings_payment_fkey" FOREIGN KEY ("installment_payment_id") REFERENCES "installment_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
