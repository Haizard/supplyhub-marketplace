-- Phase 3: verified product reviews, one per buyer per object.

CREATE TABLE "product_reviews" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "order_id" UUID,
  "rating" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "product_reviews_product_id_author_id_key" ON "product_reviews"("product_id", "author_id");
CREATE INDEX "product_reviews_product_id_created_at_idx" ON "product_reviews"("product_id", "created_at");

ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
