-- Counter sale lines keep the option that was sold, even if it is later removed.
ALTER TABLE "sale_items" ADD COLUMN "variant_id" UUID;
ALTER TABLE "sale_items" ADD COLUMN "variant_name" TEXT;
CREATE INDEX "sale_items_variant_id_idx" ON "sale_items"("variant_id");

ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
