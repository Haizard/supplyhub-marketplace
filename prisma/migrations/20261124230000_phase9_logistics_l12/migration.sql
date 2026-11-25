-- Phase 9 L12: advisory logistics optimisation.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_OPTIMIZATION_SUGGESTED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_OPTIMIZATION_DECIDED';

CREATE TYPE "OptimizationSource" AS ENUM ('BASELINE', 'AI');
CREATE TYPE "OptimizationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'BASELINE_USED');

CREATE TABLE "logistics_optimization_suggestions" (
    "id" UUID NOT NULL,
    "suggestion_number" VARCHAR(40) NOT NULL,
    "company_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "source" "OptimizationSource" NOT NULL,
    "status" "OptimizationStatus" NOT NULL DEFAULT 'PENDING',
    "model" VARCHAR(80),
    "input_hash" VARCHAR(64) NOT NULL,
    "baseline_ranking" JSONB NOT NULL,
    "ranking" JSONB NOT NULL,
    "note" VARCHAR(500),
    "decided_at" TIMESTAMPTZ(6),
    "decided_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_optimization_suggestions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_optimization_suggestions_number_key" ON "logistics_optimization_suggestions"("suggestion_number");
CREATE INDEX "logistics_optimization_suggestions_company_created_idx" ON "logistics_optimization_suggestions"("company_id", "created_at");
ALTER TABLE "logistics_optimization_suggestions" ADD CONSTRAINT "logistics_optimization_suggestions_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_optimization_suggestions" ADD CONSTRAINT "logistics_optimization_suggestions_request_fkey" FOREIGN KEY ("request_id") REFERENCES "delivery_requests"("id") ON DELETE CASCADE;
