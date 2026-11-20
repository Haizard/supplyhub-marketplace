-- Phase 1: add the business identity audit actions.
-- The phase1_business_identity migration created the business tables but the
-- AuditAction enum still lacked the actions those write paths record, so every
-- business mutation failed inside its transaction with
-- 'invalid input value for enum "AuditAction"'.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BUSINESS_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BUSINESS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BUSINESS_MEMBER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BUSINESS_MEMBER_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BUSINESS_ROLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BUSINESS_ROLE_UPDATED';
