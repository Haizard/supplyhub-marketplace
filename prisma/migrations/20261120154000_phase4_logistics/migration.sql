-- Phase 4: Shared Logistics Network
-- Agents, vehicles, documents, service areas, requests, jobs, assignments,
-- status history, live locations, proofs, earnings, commissions, pricing.

CREATE TYPE "AgentVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

CREATE TYPE "AgentPresence" AS ENUM ('OFFLINE', 'ONLINE');

CREATE TYPE "DeliveryVehicleType" AS ENUM ('BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'WALKING');

CREATE TYPE "AgentDocumentType" AS ENUM ('NATIONAL_ID', 'DRIVING_LICENSE', 'INSURANCE', 'PROFILE_PHOTO');

CREATE TYPE "VerificationState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "DeliveryRequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED');

CREATE TYPE "DeliveryJobStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'TRANSIT', 'DELIVERED', 'CANCELLED');

CREATE TYPE "DeliveryProofType" AS ENUM ('PHOTO', 'OTP', 'SIGNATURE');

CREATE TYPE "AgentEarningStatus" AS ENUM ('PENDING', 'PAID');

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_AGENT_REGISTERED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_AGENT_APPROVED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_AGENT_REJECTED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_AGENT_SUSPENDED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_AGENT_PRESENCE_CHANGED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_AGENT_DOCUMENT_REVIEWED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_REQUEST_CREATED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_REQUEST_CANCELLED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_JOB_ASSIGNED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_JOB_STATUS_CHANGED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_PROOF_RECORDED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_OTP_VERIFIED';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_EARNING_PAID';

ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_PRICING_UPDATED';

CREATE TABLE "delivery_agents" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "agent_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "presence" "AgentPresence" NOT NULL DEFAULT 'OFFLINE',
    "verification" "AgentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 5,
    "completed_trips" INTEGER NOT NULL DEFAULT 0,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_vehicles" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "type" "DeliveryVehicleType" NOT NULL,
    "plate" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_documents" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "type" "AgentDocumentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "VerificationState" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_service_areas" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radius_km" DECIMAL(8,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_service_areas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_pricing_rules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "base_fee" DECIMAL(12,2) NOT NULL,
    "per_km_rate" DECIMAL(12,2) NOT NULL,
    "minimum_fee" DECIMAL(12,2) NOT NULL,
    "maximum_fee" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_pricing_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_requests" (
    "id" UUID NOT NULL,
    "request_number" TEXT NOT NULL,
    "external_ref" TEXT,
    "order_id" UUID,
    "business_id" UUID,
    "requester_id" UUID NOT NULL,
    "pickup_name" TEXT NOT NULL,
    "pickup_phone" TEXT,
    "pickup_address" TEXT NOT NULL,
    "pickup_latitude" DECIMAL(10,7) NOT NULL,
    "pickup_longitude" DECIMAL(10,7) NOT NULL,
    "dropoff_name" TEXT NOT NULL,
    "dropoff_phone" TEXT,
    "dropoff_address" TEXT NOT NULL,
    "dropoff_latitude" DECIMAL(10,7) NOT NULL,
    "dropoff_longitude" DECIMAL(10,7) NOT NULL,
    "distance_km" DECIMAL(10,3) NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "DeliveryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_jobs" (
    "id" UUID NOT NULL,
    "job_number" TEXT NOT NULL,
    "request_id" UUID NOT NULL,
    "agent_id" UUID,
    "status" "DeliveryJobStatus" NOT NULL DEFAULT 'ASSIGNED',
    "otp_code" TEXT,
    "otp_expires_at" TIMESTAMPTZ(6),
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(6),
    "picked_up_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_assignments" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "score" DECIMAL(6,3) NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_status_history" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "from_status" "DeliveryJobStatus",
    "to_status" "DeliveryJobStatus" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_locations" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "heading" DECIMAL(6,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_proofs" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "type" "DeliveryProofType" NOT NULL,
    "storage_key" TEXT,
    "note" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_proofs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_earnings" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "AgentEarningStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agent_earnings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_commissions" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_agents_user_id_key" ON "delivery_agents"("user_id");

CREATE UNIQUE INDEX "delivery_agents_agent_code_key" ON "delivery_agents"("agent_code");

CREATE INDEX "delivery_agents_verification_presence_idx" ON "delivery_agents"("verification", "presence");

CREATE UNIQUE INDEX "delivery_vehicles_agent_id_key" ON "delivery_vehicles"("agent_id");

CREATE INDEX "agent_documents_agent_id_status_idx" ON "agent_documents"("agent_id", "status");

CREATE INDEX "agent_service_areas_agent_id_idx" ON "agent_service_areas"("agent_id");

CREATE INDEX "delivery_pricing_rules_currency_is_active_idx" ON "delivery_pricing_rules"("currency", "is_active");

CREATE UNIQUE INDEX "delivery_requests_request_number_key" ON "delivery_requests"("request_number");

CREATE UNIQUE INDEX "delivery_requests_external_ref_key" ON "delivery_requests"("external_ref");

CREATE INDEX "delivery_requests_requester_id_created_at_idx" ON "delivery_requests"("requester_id", "created_at");

CREATE INDEX "delivery_requests_business_id_status_idx" ON "delivery_requests"("business_id", "status");

CREATE INDEX "delivery_requests_status_created_at_idx" ON "delivery_requests"("status", "created_at");

CREATE UNIQUE INDEX "delivery_jobs_job_number_key" ON "delivery_jobs"("job_number");

CREATE INDEX "delivery_jobs_agent_id_status_idx" ON "delivery_jobs"("agent_id", "status");

CREATE INDEX "delivery_jobs_request_id_idx" ON "delivery_jobs"("request_id");

CREATE INDEX "delivery_jobs_status_created_at_idx" ON "delivery_jobs"("status", "created_at");

CREATE INDEX "delivery_assignments_job_id_assigned_at_idx" ON "delivery_assignments"("job_id", "assigned_at");

CREATE INDEX "delivery_assignments_agent_id_assigned_at_idx" ON "delivery_assignments"("agent_id", "assigned_at");

CREATE INDEX "delivery_status_history_job_id_created_at_idx" ON "delivery_status_history"("job_id", "created_at");

CREATE INDEX "delivery_locations_job_id_recorded_at_idx" ON "delivery_locations"("job_id", "recorded_at");

CREATE INDEX "delivery_locations_agent_id_recorded_at_idx" ON "delivery_locations"("agent_id", "recorded_at");

CREATE INDEX "delivery_proofs_job_id_recorded_at_idx" ON "delivery_proofs"("job_id", "recorded_at");

CREATE UNIQUE INDEX "agent_earnings_job_id_key" ON "agent_earnings"("job_id");

CREATE INDEX "agent_earnings_agent_id_status_idx" ON "agent_earnings"("agent_id", "status");

CREATE UNIQUE INDEX "delivery_commissions_job_id_key" ON "delivery_commissions"("job_id");

ALTER TABLE "delivery_agents" ADD CONSTRAINT "delivery_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_vehicles" ADD CONSTRAINT "delivery_vehicles_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_documents" ADD CONSTRAINT "agent_documents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_documents" ADD CONSTRAINT "agent_documents_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_service_areas" ADD CONSTRAINT "agent_service_areas_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_earnings" ADD CONSTRAINT "agent_earnings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_earnings" ADD CONSTRAINT "agent_earnings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_commissions" ADD CONSTRAINT "delivery_commissions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
