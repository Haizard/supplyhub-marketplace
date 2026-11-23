ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_BOOKING_IN_PROGRESS';
ALTER TYPE "AuditAction" ADD VALUE 'SERVICE_BOOKING_NO_SHOW';

-- Phase 7 studio permissions.
-- Group-buy and services mutations require explicit permissions for staff members;
-- legacy studios and system owner roles keep full access through their own grants.

INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES
  (gen_random_uuid(), 'groupbuy.manage', 'Create and manage community buying campaigns'),
  (gen_random_uuid(), 'services.manage', 'Manage service listings and bookings')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" IN ('groupbuy.manage', 'services.manage')
ON CONFLICT DO NOTHING;
