-- Phase 5: B2B wholesale permission keys.
INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES
  (gen_random_uuid(), 'wholesale.read', 'View wholesale listings and B2B orders'),
  (gen_random_uuid(), 'wholesale.manage', 'Manage wholesale listings and quotations'),
  (gen_random_uuid(), 'b2b.rfq.create', 'Create requests for quotation'),
  (gen_random_uuid(), 'b2b.purchase_order.create', 'Create business purchase orders'),
  (gen_random_uuid(), 'b2b.invoice.read', 'View business invoices')
ON CONFLICT ("permission_key") DO NOTHING;

-- Grant the new permissions to every system owner role so owners can use B2B.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" IN (
    'wholesale.read', 'wholesale.manage', 'b2b.rfq.create',
    'b2b.purchase_order.create', 'b2b.invoice.read'
  )
ON CONFLICT DO NOTHING;
