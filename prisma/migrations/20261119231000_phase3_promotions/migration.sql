-- Scheduled, platform-funded percentage promotions applied automatically at checkout.
CREATE TYPE "PromotionScope" AS ENUM ('MARKETPLACE', 'VENDOR', 'CATEGORY');

CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scope" "PromotionScope" NOT NULL DEFAULT 'MARKETPLACE',
    "vendor_id" UUID,
    "category_id" UUID,
    "percent" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promotions_percent_check" CHECK ("percent" >= 1 AND "percent" <= 90),
    CONSTRAINT "promotions_scope_target_check" CHECK (
        ("scope" = 'MARKETPLACE' AND "vendor_id" IS NULL AND "category_id" IS NULL)
        OR ("scope" = 'VENDOR' AND "vendor_id" IS NOT NULL AND "category_id" IS NULL)
        OR ("scope" = 'CATEGORY' AND "category_id" IS NOT NULL AND "vendor_id" IS NULL)
    )
);

CREATE INDEX "promotions_is_active_scope_idx" ON "promotions"("is_active", "scope");

ALTER TABLE "promotions" ADD CONSTRAINT "promotions_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Snapshot of the applied promotion on the order, alongside the coupon discount.
ALTER TABLE "orders" ADD COLUMN "promotion_id" UUID;
ALTER TABLE "orders" ADD COLUMN "promotion_name" TEXT;
ALTER TABLE "orders" ADD COLUMN "promotion_discount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_fkey"
    FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_DEACTIVATED';
