-- Product variants (size / colour / SKU) with their own price and stock.
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_variants_stock_check" CHECK ("stock" >= 0)
);

CREATE UNIQUE INDEX "product_variants_product_id_sku_key" ON "product_variants"("product_id", "sku");
CREATE INDEX "product_variants_product_id_sort_order_idx" ON "product_variants"("product_id", "sort_order");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One cart line per product for base products, and one line per product+variant.
ALTER TABLE "cart_items" ADD COLUMN "variant_id" UUID;
DROP INDEX "cart_items_cart_id_product_id_key";
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_variant_id_key"
    ON "cart_items"("cart_id", "product_id", "variant_id");
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_base_key"
    ON "cart_items"("cart_id", "product_id") WHERE "variant_id" IS NULL;
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order lines keep the variant snapshot even if the variant is later removed.
ALTER TABLE "order_items" ADD COLUMN "variant_id" UUID;
ALTER TABLE "order_items" ADD COLUMN "variant_name" TEXT;
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
