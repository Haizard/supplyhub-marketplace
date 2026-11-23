-- Phase 6: account security — TOTP, backup codes and phone verification.

ALTER TABLE "users"
    ADD COLUMN "phone_verified_at" TIMESTAMPTZ(6),
    ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "two_factor_secret" TEXT,
    ADD COLUMN "two_factor_last_step" INTEGER;

ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_SETUP_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'BACKUP_CODES_REGENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'BACKUP_CODE_USED';
ALTER TYPE "AuditAction" ADD VALUE 'PHONE_VERIFICATION_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'PHONE_VERIFIED';

CREATE TABLE "backup_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "phone_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" VARCHAR(24) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "backup_codes_code_hash_key" ON "backup_codes"("code_hash");
CREATE INDEX "backup_codes_user_id_used_at_idx" ON "backup_codes"("user_id", "used_at");
CREATE INDEX "phone_verifications_user_id_phone_created_at_idx" ON "phone_verifications"("user_id", "phone", "created_at");

ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
