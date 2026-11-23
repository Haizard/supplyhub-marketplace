-- Phase 6: persisted successful sign-in events for account security alerts.

ALTER TYPE "AuditAction" ADD VALUE 'SIGN_IN_SUCCEEDED';

CREATE TABLE "sign_in_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" VARCHAR(120) NOT NULL,
    "location" VARCHAR(160) NOT NULL,
    "ip_address" VARCHAR(64),
    "method" VARCHAR(32) NOT NULL,
    "new_device" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sign_in_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sign_in_events_user_id_occurred_at_idx" ON "sign_in_events"("user_id", "occurred_at");
CREATE INDEX "sign_in_events_user_id_device_idx" ON "sign_in_events"("user_id", "device");

ALTER TABLE "sign_in_events" ADD CONSTRAINT "sign_in_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
