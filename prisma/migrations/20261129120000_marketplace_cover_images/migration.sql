-- Marketplace cover photography for produce, services and logistics listings.

ALTER TABLE "agricultural_listings" ADD COLUMN "cover_image_url" VARCHAR(500);
ALTER TABLE "service_listings" ADD COLUMN "cover_image_url" VARCHAR(500);
ALTER TABLE "logistics_companies" ADD COLUMN "cover_image_url" VARCHAR(500);
