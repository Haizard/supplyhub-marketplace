-- Phase 6 follow-up: track consumed phone verification challenges.

ALTER TABLE "phone_verifications"
    ADD COLUMN "used_at" TIMESTAMPTZ(6);
