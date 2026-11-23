-- Phase 7 foundations: feature flags and a transactional outbox.

ALTER TYPE "AuditAction" ADD VALUE 'FEATURE_FLAG_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'FEATURE_FLAG_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'OUTBOX_EVENT_DISPATCHED';
ALTER TYPE "AuditAction" ADD VALUE 'OUTBOX_EVENT_FAILED';

CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(600) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(120),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");
CREATE INDEX "feature_flags_enabled_key_idx" ON "feature_flags"("enabled", "key");
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");
CREATE INDEX "outbox_events_event_type_created_at_idx" ON "outbox_events"("event_type", "created_at");
