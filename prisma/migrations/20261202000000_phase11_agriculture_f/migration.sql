-- Phase 11 F: advisory agriculture assistant records.

ALTER TYPE "AuditAction" ADD VALUE 'AGRICULTURE_ADVICE_GENERATED';

CREATE TYPE "AgricultureAdviceSource" AS ENUM ('BASELINE', 'AI');

CREATE TABLE "agriculture_advice" (
  "id" UUID NOT NULL, "farmer_id" UUID NOT NULL, "request_id" VARCHAR(40) NOT NULL,
  "question" TEXT NOT NULL, "language" VARCHAR(8) NOT NULL, "source" "AgricultureAdviceSource" NOT NULL,
  "model" VARCHAR(80), "signals_hash" VARCHAR(64) NOT NULL, "baseline" JSONB NOT NULL,
  "advice" JSONB NOT NULL, "note" VARCHAR(500), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agriculture_advice_pkey" PRIMARY KEY ("id"), CONSTRAINT "agriculture_advice_request_key" UNIQUE ("request_id")
);
CREATE INDEX "agriculture_advice_farmer_created_idx" ON "agriculture_advice"("farmer_id", "created_at");
ALTER TABLE "agriculture_advice" ADD CONSTRAINT "agriculture_advice_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "agriculture_farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
