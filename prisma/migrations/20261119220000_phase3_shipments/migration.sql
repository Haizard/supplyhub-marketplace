-- One shipment record per studio order, captured when the studio hands the parcel over.
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "vendor_order_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "carrier" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "tracking_url" TEXT,
    "shipped_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipments_vendor_order_id_key" ON "shipments"("vendor_order_id");
CREATE INDEX "shipments_vendor_id_created_at_idx" ON "shipments"("vendor_id", "created_at");

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vendor_order_id_fkey"
    FOREIGN KEY ("vendor_order_id") REFERENCES "vendor_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
