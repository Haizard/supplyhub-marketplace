-- Phase 9 L4: independent merchant clients and contacts.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CLIENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CLIENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CLIENT_CONTACT_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_CLIENT_RELATIONSHIP_CHANGED';

CREATE TYPE "LogisticsClientStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'ENDED');
CREATE TYPE "ClientRelationshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED');

CREATE TABLE "logistics_clients" (
    "id" UUID NOT NULL,
    "client_number" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "business_name" VARCHAR,
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "business_id" UUID,
    "vendor_id" UUID,
    "address" VARCHAR(300),
    "city" VARCHAR(120),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "LogisticsClientStatus" NOT NULL DEFAULT 'PROSPECT',
    "referral_code" VARCHAR(64),
    "verified_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "logistics_clients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "logistics_clients_number_key" ON "logistics_clients"("client_number");
CREATE INDEX "logistics_clients_status_created_idx" ON "logistics_clients"("status", "created_at");
ALTER TABLE "logistics_clients" ADD CONSTRAINT "logistics_clients_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL;
ALTER TABLE "logistics_clients" ADD CONSTRAINT "logistics_clients_vendor_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL;

CREATE TABLE "company_client_relationships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "ClientRelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "account_code" VARCHAR(64),
    "service_notes" TEXT,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "company_client_relationships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_client_relationships_company_client_key" ON "company_client_relationships"("company_id", "client_id");
CREATE INDEX "company_client_relationships_company_status_idx" ON "company_client_relationships"("company_id", "status");
ALTER TABLE "company_client_relationships" ADD CONSTRAINT "company_client_relationships_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE CASCADE;
ALTER TABLE "company_client_relationships" ADD CONSTRAINT "company_client_relationships_client_fkey" FOREIGN KEY ("client_id") REFERENCES "logistics_clients"("id") ON DELETE CASCADE;

CREATE TABLE "logistics_client_contacts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,
    "role" VARCHAR(80),
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_client_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "logistics_client_contacts_client_primary_idx" ON "logistics_client_contacts"("client_id", "is_primary");
ALTER TABLE "logistics_client_contacts" ADD CONSTRAINT "logistics_client_contacts_client_fkey" FOREIGN KEY ("client_id") REFERENCES "logistics_clients"("id") ON DELETE CASCADE;
EOF
npx prisma generate 2>&1 | tail -8