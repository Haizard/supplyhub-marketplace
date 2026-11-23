-- Phase 8: trust, verification and operations.

ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_VERIFICATION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_VERIFICATION_REVIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'DISPUTE_OPENED';
ALTER TYPE "AuditAction" ADD VALUE 'DISPUTE_MESSAGE_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'DISPUTE_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'RECONCILIATION_RUN_COMPLETED';

CREATE TYPE "VerificationDocumentType" AS ENUM ('BUSINESS_REGISTRATION', 'TAX_ID', 'ID_DOCUMENT', 'BANK_STATEMENT', 'OTHER');
CREATE TYPE "VerificationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- ── Business verification ───────────────────────────────────────────────────

CREATE TABLE "business_verification_documents" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "document_type" "VerificationDocumentType" NOT NULL,
    "reference" VARCHAR(160) NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "status" "VerificationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "business_verification_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bvd_business_status_idx" ON "business_verification_documents"("business_id", "status");
CREATE INDEX "bvd_status_created_idx" ON "business_verification_documents"("status", "created_at");
ALTER TABLE "business_verification_documents" ADD CONSTRAINT "bvd_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
ALTER TABLE "business_verification_documents" ADD CONSTRAINT "bvd_reviewer_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE "business_verification_reviews" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "document_id" UUID,
    "reviewer_id" UUID NOT NULL,
    "decision" "VerificationReviewStatus" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_verification_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bvr_business_created_idx" ON "business_verification_reviews"("business_id", "created_at");
ALTER TABLE "business_verification_reviews" ADD CONSTRAINT "bvr_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
ALTER TABLE "business_verification_reviews" ADD CONSTRAINT "bvr_document_fkey" FOREIGN KEY ("document_id") REFERENCES "business_verification_documents"("id") ON DELETE SET NULL;
ALTER TABLE "business_verification_reviews" ADD CONSTRAINT "bvr_reviewer_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT;

-- ── Dispute resolution ──────────────────────────────────────────────────────

CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "dispute_number" VARCHAR NOT NULL,
    "order_id" UUID NOT NULL,
    "vendor_order_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "reason" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "disputes_number_key" ON "disputes"("dispute_number");
CREATE INDEX "disputes_buyer_created_idx" ON "disputes"("buyer_id", "created_at");
CREATE INDEX "disputes_vendor_status_idx" ON "disputes"("vendor_id", "status");
CREATE INDEX "disputes_status_created_idx" ON "disputes"("status", "created_at");
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_vendor_order_fkey" FOREIGN KEY ("vendor_order_id") REFERENCES "vendor_orders"("id") ON DELETE RESTRICT;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_buyer_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_vendor_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolver_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE "dispute_messages" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "dm_dispute_created_idx" ON "dispute_messages"("dispute_id", "created_at");
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dm_dispute_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE;
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dm_sender_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT;

-- ── Payment reconciliation ──────────────────────────────────────────────────

CREATE TABLE "reconciliation_runs" (
    "id" UUID NOT NULL,
    "run_number" VARCHAR NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "checked_count" INTEGER NOT NULL DEFAULT 0,
    "finding_count" INTEGER NOT NULL DEFAULT 0,
    "initiated_by_id" UUID,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reconciliation_runs_number_key" ON "reconciliation_runs"("run_number");
CREATE INDEX "reconciliation_runs_status_created_idx" ON "reconciliation_runs"("status", "created_at");
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_initiator_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE "reconciliation_findings" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "payment_id" UUID,
    "severity" "FindingSeverity" NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "message" TEXT NOT NULL,
    "expected" VARCHAR(80),
    "actual" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reconciliation_findings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rf_run_severity_idx" ON "reconciliation_findings"("run_id", "severity");
ALTER TABLE "reconciliation_findings" ADD CONSTRAINT "rf_run_fkey" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE;
ALTER TABLE "reconciliation_findings" ADD CONSTRAINT "rf_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL;
EOF
echo "migration written"
-- Business staff need an explicit permission to submit KYC documents.
INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES (gen_random_uuid(), 'verification.manage', 'Submit and view business verification documents')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" = 'verification.manage'
ON CONFLICT DO NOTHING;
