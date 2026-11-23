-- Phase 5: B2B Wholesale Network
-- Supplier listings with volume price tiers, RFQs, quotations,
-- business purchase orders and invoices.

CREATE TYPE "WholesaleListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'RECEIVED', 'CANCELLED');

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

ALTER TYPE "AuditAction" ADD VALUE 'WHOLESALE_LISTING_CREATED';

ALTER TYPE "AuditAction" ADD VALUE 'WHOLESALE_LISTING_UPDATED';

ALTER TYPE "AuditAction" ADD VALUE 'WHOLESALE_LISTING_ARCHIVED';

ALTER TYPE "AuditAction" ADD VALUE 'RFQ_CREATED';

ALTER TYPE "AuditAction" ADD VALUE 'RFQ_SUBMITTED';

ALTER TYPE "AuditAction" ADD VALUE 'RFQ_CANCELLED';

ALTER TYPE "AuditAction" ADD VALUE 'QUOTATION_CREATED';

ALTER TYPE "AuditAction" ADD VALUE 'QUOTATION_SENT';

ALTER TYPE "AuditAction" ADD VALUE 'QUOTATION_ACCEPTED';

ALTER TYPE "AuditAction" ADD VALUE 'QUOTATION_REJECTED';

ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_ORDER_CREATED';

ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_ORDER_STATUS_CHANGED';

ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_ISSUED';

ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_PAID';

CREATE TABLE "wholesale_listings" (
    "id" UUID NOT NULL,
    "listing_number" TEXT NOT NULL,
    "vendor_id" UUID NOT NULL,
    "business_id" UUID,
    "product_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "minimum_order" INTEGER NOT NULL,
    "stock_available" INTEGER NOT NULL,
    "lead_time_days" INTEGER NOT NULL DEFAULT 7,
    "status" "WholesaleListingStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wholesale_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wholesale_price_tiers" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "max_qty" INTEGER,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wholesale_price_tiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rfqs" (
    "id" UUID NOT NULL,
    "rfq_number" TEXT NOT NULL,
    "buyer_business_id" UUID NOT NULL,
    "supplier_vendor_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "note" TEXT,
    "target_date" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rfq_items" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "listing_id" UUID,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "target_price" DECIMAL(12,2),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_quotations" (
    "id" UUID NOT NULL,
    "quotation_number" TEXT NOT NULL,
    "rfq_id" UUID NOT NULL,
    "supplier_vendor_id" UUID NOT NULL,
    "business_id" UUID,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "valid_until" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "rfq_item_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_purchase_orders" (
    "id" UUID NOT NULL,
    "po_number" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "supplier_vendor_id" UUID NOT NULL,
    "quotation_id" UUID,
    "submitted_by_id" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "ordered_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_purchase_order_items" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "listing_id" UUID,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_invoices" (
    "id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "supplier_vendor_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "due_at" TIMESTAMPTZ(6),
    "issued_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wholesale_listings_listing_number_key" ON "wholesale_listings"("listing_number");

CREATE INDEX "wholesale_listings_status_published_at_idx" ON "wholesale_listings"("status", "published_at");

CREATE INDEX "wholesale_listings_vendor_id_status_idx" ON "wholesale_listings"("vendor_id", "status");

CREATE UNIQUE INDEX "wholesale_listings_vendor_id_sku_key" ON "wholesale_listings"("vendor_id", "sku");

CREATE INDEX "wholesale_price_tiers_listing_id_idx" ON "wholesale_price_tiers"("listing_id");

CREATE UNIQUE INDEX "wholesale_price_tiers_listing_id_min_qty_key" ON "wholesale_price_tiers"("listing_id", "min_qty");

CREATE UNIQUE INDEX "rfqs_rfq_number_key" ON "rfqs"("rfq_number");

CREATE INDEX "rfqs_buyer_business_id_status_idx" ON "rfqs"("buyer_business_id", "status");

CREATE INDEX "rfqs_supplier_vendor_id_status_idx" ON "rfqs"("supplier_vendor_id", "status");

CREATE INDEX "rfq_items_rfq_id_idx" ON "rfq_items"("rfq_id");

CREATE UNIQUE INDEX "supplier_quotations_quotation_number_key" ON "supplier_quotations"("quotation_number");

CREATE INDEX "supplier_quotations_rfq_id_idx" ON "supplier_quotations"("rfq_id");

CREATE INDEX "supplier_quotations_supplier_vendor_id_status_idx" ON "supplier_quotations"("supplier_vendor_id", "status");

CREATE UNIQUE INDEX "quotation_items_quotation_id_rfq_item_id_key" ON "quotation_items"("quotation_id", "rfq_item_id");

CREATE UNIQUE INDEX "business_purchase_orders_po_number_key" ON "business_purchase_orders"("po_number");

CREATE INDEX "business_purchase_orders_business_id_status_idx" ON "business_purchase_orders"("business_id", "status");

CREATE INDEX "business_purchase_orders_supplier_vendor_id_status_idx" ON "business_purchase_orders"("supplier_vendor_id", "status");

CREATE INDEX "business_purchase_order_items_purchase_order_id_idx" ON "business_purchase_order_items"("purchase_order_id");

CREATE UNIQUE INDEX "business_invoices_invoice_number_key" ON "business_invoices"("invoice_number");

CREATE INDEX "business_invoices_business_id_status_idx" ON "business_invoices"("business_id", "status");

CREATE INDEX "business_invoices_supplier_vendor_id_status_idx" ON "business_invoices"("supplier_vendor_id", "status");

CREATE INDEX "business_invoice_items_invoice_id_idx" ON "business_invoice_items"("invoice_id");

ALTER TABLE "wholesale_listings" ADD CONSTRAINT "wholesale_listings_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wholesale_listings" ADD CONSTRAINT "wholesale_listings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wholesale_listings" ADD CONSTRAINT "wholesale_listings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wholesale_price_tiers" ADD CONSTRAINT "wholesale_price_tiers_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "wholesale_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyer_business_id_fkey" FOREIGN KEY ("buyer_business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_supplier_vendor_id_fkey" FOREIGN KEY ("supplier_vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_supplier_vendor_id_fkey" FOREIGN KEY ("supplier_vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_rfq_item_id_fkey" FOREIGN KEY ("rfq_item_id") REFERENCES "rfq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_purchase_orders" ADD CONSTRAINT "business_purchase_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_purchase_orders" ADD CONSTRAINT "business_purchase_orders_supplier_vendor_id_fkey" FOREIGN KEY ("supplier_vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_purchase_orders" ADD CONSTRAINT "business_purchase_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "business_purchase_orders" ADD CONSTRAINT "business_purchase_orders_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_purchase_order_items" ADD CONSTRAINT "business_purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "business_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "business_purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_supplier_vendor_id_fkey" FOREIGN KEY ("supplier_vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_invoice_items" ADD CONSTRAINT "business_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "business_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
