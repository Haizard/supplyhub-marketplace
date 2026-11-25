-- Phase 9 L6: company dispatch on the shared delivery engine.

ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_REQUEST_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_JOB_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_JOB_REASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGISTICS_COMPANY_JOB_STATUS_CHANGED';

ALTER TABLE "delivery_requests"
  ADD COLUMN "source" VARCHAR(16) NOT NULL DEFAULT 'PLATFORM',
  ADD COLUMN "company_id" UUID,
  ADD COLUMN "contract_id" UUID;
CREATE INDEX "delivery_requests_company_status_idx" ON "delivery_requests"("company_id", "status");

ALTER TABLE "delivery_jobs"
  ADD COLUMN "company_id" UUID,
  ADD COLUMN "contract_id" UUID,
  ADD COLUMN "driver_membership_id" UUID;
CREATE INDEX "delivery_jobs_company_status_idx" ON "delivery_jobs"("company_id", "status");
CREATE INDEX "delivery_jobs_membership_status_idx" ON "delivery_jobs"("driver_membership_id", "status");

-- A company assignment targets a driver membership rather than a platform courier,
-- so agent_id becomes nullable. Existing assignments keep their agent.
ALTER TABLE "delivery_assignments" DROP CONSTRAINT IF EXISTS "delivery_assignments_agent_id_fkey";
ALTER TABLE "delivery_assignments" ALTER COLUMN "agent_id" DROP NOT NULL;
ALTER TABLE "delivery_assignments"
  ADD CONSTRAINT "delivery_assignments_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_assignments" ADD COLUMN "driver_membership_id" UUID;
CREATE INDEX "delivery_assignments_membership_idx" ON "delivery_assignments"("driver_membership_id", "assigned_at");

ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "logistics_contracts"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_company_fkey" FOREIGN KEY ("company_id") REFERENCES "logistics_companies"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "logistics_contracts"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_membership_fkey" FOREIGN KEY ("driver_membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_membership_fkey" FOREIGN KEY ("driver_membership_id") REFERENCES "driver_company_memberships"("id") ON DELETE SET NULL;
EOF
npx prisma generate 2>&1 | tail -6