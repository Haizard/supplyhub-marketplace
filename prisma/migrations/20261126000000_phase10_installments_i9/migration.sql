-- Phase 10 I9: financing offer acceptance and settlement records.
-- Regulated platform financing remains gated by a disabled flag; this migration
-- only adds record-keeping columns and no money movement.

ALTER TYPE "InstallmentFinancingStatus" ADD VALUE 'ACCEPTED' BEFORE 'FUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_FINANCING_DECIDED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_FINANCING_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'INSTALLMENT_FINANCING_FUNDED';

ALTER TABLE "installment_financing_applications"
  ADD COLUMN "offered_amount" DECIMAL(14,2),
  ADD COLUMN "offered_at" TIMESTAMPTZ(6),
  ADD COLUMN "accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN "funded_at" TIMESTAMPTZ(6),
  ADD COLUMN "provider_reference" VARCHAR(160),
  ADD COLUMN "decided_at" TIMESTAMPTZ(6);
