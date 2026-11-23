-- Phase 6: deterministic business insights and buyer recommendation history.

CREATE TYPE "InsightType" AS ENUM ('LOW_STOCK', 'REVENUE_TREND', 'INVENTORY_IMBALANCE', 'CUSTOMER_RETENTION', 'RECOMMENDED_RESTOCK');
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'OPPORTUNITY', 'WARNING');
CREATE TYPE "RecommendationSurface" AS ENUM ('HOME', 'CATALOG', 'ACCOUNT');

ALTER TYPE "AuditAction" ADD VALUE 'AI_INSIGHTS_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_RECOMMENDATIONS_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_RECOMMENDATION_DISMISSED';

CREATE TABLE "business_ai_insights" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "type" "InsightType" NOT NULL,
    "severity" "InsightSeverity" NOT NULL DEFAULT 'INFO',
    "title" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(600) NOT NULL,
    "recommendation" VARCHAR(600) NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 80,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "model_version" VARCHAR(64) NOT NULL DEFAULT 'configurable-rules-v1',
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_ai_insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_recommendation_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "surface" "RecommendationSurface" NOT NULL DEFAULT 'CATALOG',
    "score" DECIMAL(6,3),
    "reason" VARCHAR(300) NOT NULL,
    "model_version" VARCHAR(64) NOT NULL DEFAULT 'configurable-rules-v1',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_recommendation_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_ai_insights_business_id_generated_at_idx" ON "business_ai_insights"("business_id", "generated_at");
CREATE INDEX "ai_recommendation_history_user_id_created_at_idx" ON "ai_recommendation_history"("user_id", "created_at");
CREATE INDEX "ai_recommendation_history_product_id_idx" ON "ai_recommendation_history"("product_id");

ALTER TABLE "business_ai_insights" ADD CONSTRAINT "business_ai_insights_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_recommendation_history" ADD CONSTRAINT "ai_recommendation_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_recommendation_history" ADD CONSTRAINT "ai_recommendation_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES (gen_random_uuid(), 'insights.read', 'View business AI insights')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" = 'insights.read'
ON CONFLICT DO NOTHING;
