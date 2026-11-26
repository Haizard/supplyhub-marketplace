-- Phase 10 I6-I8: contract documents, advanced reporting data and financing interface.

ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_CONTRACT_DOCUMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_CONTRACT_SIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_CONTRACT_VOIDED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_AMENDMENT_PROPOSED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_AMENDMENT_DECIDED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_FINANCING_SUBMITTED';

CREATE TYPE "InstallmentDocumentStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURES', 'SIGNED', 'VOID');
CREATE TYPE "InstallmentSignatureRole" AS ENUM ('BUYER', 'SELLER');
CREATE TYPE "InstallmentAmendmentStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "InstallmentFinancingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'DECLINED', 'FUNDED', 'CANCELLED');

CREATE TABLE "installment_contract_documents" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(40) NOT NULL,
    "agreement_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "status" "InstallmentDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_contract_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_contract_documents_number_key" UNIQUE ("document_number"),
    CONSTRAINT "installment_contract_documents_version_key" UNIQUE ("agreement_id", "version")
);
ALTER TABLE "installment_contract_documents" ADD CONSTRAINT "installment_contract_documents_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_contract_signatures" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "signer_user_id" UUID NOT NULL,
    "role" "InstallmentSignatureRole" NOT NULL,
    "method" VARCHAR(40) NOT NULL DEFAULT 'ACCOUNT_SESSION',
    "evidence_hash" VARCHAR(64) NOT NULL,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_contract_signatures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_contract_signatures_unique" UNIQUE ("document_id", "role")
);
ALTER TABLE "installment_contract_signatures" ADD CONSTRAINT "installment_contract_signatures_document_fkey" FOREIGN KEY ("document_id") REFERENCES "installment_contract_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_contract_signatures" ADD CONSTRAINT "installment_contract_signatures_signer_fkey" FOREIGN KEY ("signer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "installment_amendments" (
    "id" UUID NOT NULL,
    "amendment_number" VARCHAR(40) NOT NULL,
    "agreement_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "InstallmentAmendmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposed_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installment_amendments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_amendments_number_key" UNIQUE ("amendment_number")
);
CREATE INDEX "installment_amendments_agreement_created_idx" ON "installment_amendments"("agreement_id", "created_at");
ALTER TABLE "installment_amendments" ADD CONSTRAINT "installment_amendments_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_financing_applications" (
    "id" UUID NOT NULL,
    "application_number" VARCHAR(40) NOT NULL,
    "agreement_id" UUID NOT NULL,
    "partner_code" VARCHAR(60) NOT NULL,
    "requested_amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "InstallmentFinancingStatus" NOT NULL DEFAULT 'DRAFT',
    "decision_note" TEXT,
    "submitted_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "installment_financing_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installment_financing_applications_number_key" UNIQUE ("application_number"),
    CONSTRAINT "installment_financing_applications_amount_positive" CHECK ("requested_amount" > 0)
);
CREATE INDEX "installment_financing_applications_agreement_status_idx" ON "installment_financing_applications"("agreement_id", "status");
ALTER TABLE "installment_financing_applications" ADD CONSTRAINT "installment_financing_applications_agreement_fkey" FOREIGN KEY ("agreement_id") REFERENCES "installment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regulated platform financing stays off until compliance approval and a separate flag.
INSERT INTO "feature_flags" ("id", "key", "name", "description", "enabled", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'phase10.installmentFinancing', 'Installment financing partner interface',
        'Prepared interface only. No partner calls or money movement.', false, now(), now())
ON CONFLICT ("key") DO NOTHING;
