-- Phase 9 L5: commercial contracts, pricing, SLAs, deliveries and invoices.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CONTRACT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CONTRACT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CONTRACT_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CONTRACT_DELIVERY_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_INVOICE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_INVOICE_UPDATED';

CREATE TYPE "LogisticsContractType" AS ENUM ('PER_DELIVERY', 'MONTHLY', 'VOLUME', 'DEDICATED_FLEET', 'GEOGRAPHIC', 'HYBRID');
CREATE TYPE "LogisticsContractStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');
CREATE TYPE "PricingMode" AS ENUM ('PER_DELIVERY', 'FLAT_MONTHLY', 'TIERED_VOLUME', 'PER_KM');
CREATE TYPE "LogisticsInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "logistics_contracts" (
    "id" UUID NOT NULL,
    "contract_number" VARCHAR NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" "LogisticsContractType" NOT NULL,
    "status" "LogisticsContractStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" UUID,
    "title" VARCHAR NOT NULL,
    "description" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "monthly_allocation" INTEGER,
    "coverage_area" VARCHAR(200),
    "service_hours" VARCHAR(120),
    "payment_terms" VARCHAR(200),
    "accepted_at" TIMESTAMPTZ(6),
    "accepted_by_id" UUID,
    "suspended_at" TIMESTAMPTZ(6),
    "terminated_at" TIMESTAMPTZ(6),
    "termination_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_contracts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_contracts_number_key" ON "logistics_contracts"("contract_number");
CREATE INDEX "logistics_contracts_company_status_idx" ON "logistics_contracts"("company_id", "status");
CREATE INDEX "logistics_contracts_client_status_idx" ON "logistics_contracts"("client_id", "status");
ALTER TABLE "logistics_contracts" ADD CONSTRAINT "logistics_contracts_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_contracts" ADD CONSTRAINT "logistics_contracts_client_fkey" FOREIGN KEY ("client_id") REFERENCES "logistics_clients"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_contracts" ADD CONSTRAINT "logistics_contracts_previous_version_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "logistics_contracts"("id") ON DELETE SET NULL;

CREATE TABLE "contract_pricing" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "mode" "PricingMode" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "per_delivery" DECIMAL(12,2),
    "monthly_fee" DECIMAL(12,2),
    "per_km_rate" DECIMAL(12,2),
    "minimum_fee" DECIMAL(12,2),
    "included_units" INTEGER,
    "tier_json" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "contract_pricing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_pricing_contract_key" ON "contract_pricing"("contract_id");
ALTER TABLE "contract_pricing" ADD CONSTRAINT "contract_pricing_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "logistics_contracts"("id") ON DELETE CASCADE;

CREATE TABLE "contract_slas" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "max_delivery_hours" INTEGER,
    "min_completion_rate_bps" INTEGER,
    "proof_required" BOOLEAN NOT NULL DEFAULT true,
    "otp_required" BOOLEAN NOT NULL DEFAULT true,
    "claims_window_days" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "contract_slas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_slas_contract_key" ON "contract_slas"("contract_id");
ALTER TABLE "contract_slas" ADD CONSTRAINT "contract_slas_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "logistics_contracts"("id") ON DELETE CASCADE;

CREATE TABLE "contract_deliveries" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "delivery_job_id" UUID,
    "reference" VARCHAR(120) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "charge" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "delivered_at" TIMESTAMPTZ(6),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contract_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_deliveries_job_key" ON "contract_deliveries"("delivery_job_id");
CREATE INDEX "contract_deliveries_contract_status_idx" ON "contract_deliveries"("contract_id", "status");
ALTER TABLE "contract_deliveries" ADD CONSTRAINT "contract_deliveries_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "logistics_contracts"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_invoices" (
    "id" UUID NOT NULL,
    "invoice_number" VARCHAR NOT NULL,
    "contract_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "LogisticsInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_invoices_number_key" ON "logistics_invoices"("invoice_number");
CREATE INDEX "logistics_invoices_company_status_idx" ON "logistics_invoices"("company_id", "status");
CREATE INDEX "logistics_invoices_client_created_idx" ON "logistics_invoices"("client_id", "created_at");
ALTER TABLE "logistics_invoices" ADD CONSTRAINT "logistics_invoices_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "logistics_contracts"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_invoices" ADD CONSTRAINT "logistics_invoices_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "logistics_invoices" ADD CONSTRAINT "logistics_invoices_client_fkey" FOREIGN KEY ("client_id") REFERENCES "logistics_clients"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_invoice_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "logistics_invoice_items_invoice_idx" ON "logistics_invoice_items"("invoice_id");
ALTER TABLE "logistics_invoice_items" ADD CONSTRAINT "logistics_invoice_items_invoice_fkey" FOREIGN KEY ("invoice_id") REFERENCES "logistics_invoices"("id") ON DELETE CASCADE;
EOF
npx prisma generate 2>&1 | tail -8