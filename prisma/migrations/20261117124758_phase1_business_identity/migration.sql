-- Phase 1: Business Identity and Organisation
-- Creates the multi-business, multi-member, role-permission foundation.
-- All additions are additive; no existing tables are altered or dropped.

-- ── Business categories ───────────────────────────────────────────────────────
CREATE TABLE "business_categories" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"       TEXT        NOT NULL,
  "slug"       TEXT        NOT NULL,
  "parent_id"  UUID,
  "sort_order" INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "business_categories_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "business_categories_slug_key"  UNIQUE ("slug"),
  CONSTRAINT "business_categories_parent_fk" FOREIGN KEY ("parent_id")
    REFERENCES "business_categories"("id") ON DELETE SET NULL
);
CREATE INDEX "business_categories_parent_idx" ON "business_categories"("parent_id");

-- ── Businesses ────────────────────────────────────────────────────────────────
CREATE TABLE "businesses" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "business_code"       TEXT        NOT NULL,
  "name"                TEXT        NOT NULL,
  "slug"                TEXT        NOT NULL,
  "category_id"         UUID,
  "verification_status" TEXT        NOT NULL DEFAULT 'unverified',
  "description"         TEXT,
  "logo_key"            TEXT,
  "website"             TEXT,
  "contact_phone"       TEXT,
  "contact_email"       TEXT,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "businesses_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "businesses_code_key"       UNIQUE ("business_code"),
  CONSTRAINT "businesses_slug_key"       UNIQUE ("slug"),
  CONSTRAINT "businesses_category_fk"    FOREIGN KEY ("category_id")
    REFERENCES "business_categories"("id") ON DELETE SET NULL
);
CREATE INDEX "businesses_verification_idx" ON "businesses"("verification_status");

-- ── Business branches ─────────────────────────────────────────────────────────
CREATE TABLE "business_branches" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "business_id"   UUID        NOT NULL,
  "name"          TEXT        NOT NULL,
  "branch_code"   TEXT        NOT NULL,
  "address"       TEXT,
  "city"          TEXT,
  "latitude"      DECIMAL(10,7),
  "longitude"     DECIMAL(10,7),
  "is_primary"    BOOLEAN     NOT NULL DEFAULT false,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "business_branches_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "business_branches_code_key"    UNIQUE ("business_id", "branch_code"),
  CONSTRAINT "business_branches_business_fk" FOREIGN KEY ("business_id")
    REFERENCES "businesses"("id") ON DELETE CASCADE
);
CREATE INDEX "business_branches_business_idx" ON "business_branches"("business_id");

-- ── Platform permission catalogue ─────────────────────────────────────────────
CREATE TABLE "permissions" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "permission_key" TEXT NOT NULL,
  "description"    TEXT NOT NULL DEFAULT '',
  CONSTRAINT "permissions_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "permissions_key_unique"      UNIQUE ("permission_key")
);

-- ── Business-defined roles ────────────────────────────────────────────────────
CREATE TABLE "business_roles" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID        NOT NULL,
  "name"        TEXT        NOT NULL,
  "is_system"   BOOLEAN     NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "business_roles_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "business_roles_name_unique" UNIQUE ("business_id", "name"),
  CONSTRAINT "business_roles_business_fk" FOREIGN KEY ("business_id")
    REFERENCES "businesses"("id") ON DELETE CASCADE
);

-- ── Role ↔ permission pivot ───────────────────────────────────────────────────
CREATE TABLE "role_permissions" (
  "role_id"       UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  CONSTRAINT "role_permissions_pkey"         PRIMARY KEY ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_role_fk"      FOREIGN KEY ("role_id")
    REFERENCES "business_roles"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permission_fk" FOREIGN KEY ("permission_id")
    REFERENCES "permissions"("id") ON DELETE CASCADE
);

-- ── Business members (user ↔ business) ───────────────────────────────────────
CREATE TABLE "business_members" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID        NOT NULL,
  "user_id"     UUID        NOT NULL,
  "status"      TEXT        NOT NULL DEFAULT 'active',
  "invited_by"  UUID,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "business_members_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "business_members_unique"       UNIQUE ("business_id", "user_id"),
  CONSTRAINT "business_members_business_fk"  FOREIGN KEY ("business_id")
    REFERENCES "businesses"("id") ON DELETE CASCADE,
  CONSTRAINT "business_members_user_fk"      FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "business_members_inviter_fk"   FOREIGN KEY ("invited_by")
    REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "business_members_user_idx"     ON "business_members"("user_id");
CREATE INDEX "business_members_business_idx" ON "business_members"("business_id");

-- ── Member ↔ role pivot ───────────────────────────────────────────────────────
CREATE TABLE "member_roles" (
  "member_id" UUID NOT NULL,
  "role_id"   UUID NOT NULL,
  CONSTRAINT "member_roles_pkey"       PRIMARY KEY ("member_id", "role_id"),
  CONSTRAINT "member_roles_member_fk"  FOREIGN KEY ("member_id")
    REFERENCES "business_members"("id") ON DELETE CASCADE,
  CONSTRAINT "member_roles_role_fk"    FOREIGN KEY ("role_id")
    REFERENCES "business_roles"("id") ON DELETE CASCADE
);

-- ── Business documents (KYC) ──────────────────────────────────────────────────
CREATE TABLE "business_documents" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "business_id"         UUID        NOT NULL,
  "document_type"       TEXT        NOT NULL,
  "storage_key"         TEXT        NOT NULL,
  "verification_status" TEXT        NOT NULL DEFAULT 'pending',
  "reviewed_by_id"      UUID,
  "reviewed_at"         TIMESTAMPTZ(6),
  "review_note"         TEXT,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "business_documents_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "business_documents_key_unique"  UNIQUE ("storage_key"),
  CONSTRAINT "business_documents_business_fk" FOREIGN KEY ("business_id")
    REFERENCES "businesses"("id") ON DELETE CASCADE,
  CONSTRAINT "business_documents_reviewer_fk" FOREIGN KEY ("reviewed_by_id")
    REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "business_documents_business_idx" ON "business_documents"("business_id");

-- ── Business settings (JSON bag) ──────────────────────────────────────────────
CREATE TABLE "business_settings" (
  "business_id"   UUID NOT NULL,
  "settings_json" JSONB NOT NULL DEFAULT '{}',
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "business_settings_pkey"        PRIMARY KEY ("business_id"),
  CONSTRAINT "business_settings_business_fk" FOREIGN KEY ("business_id")
    REFERENCES "businesses"("id") ON DELETE CASCADE
);

-- ── Link vendors to their business ───────────────────────────────────────────
-- Nullable: backfilled after migration; existing vendors get a business created
-- for them by the seed/backfill script. NOT enforced NOT NULL until backfill done.
ALTER TABLE "vendors" ADD COLUMN "business_id" UUID
  REFERENCES "businesses"("id") ON DELETE SET NULL;
CREATE INDEX "vendors_business_idx" ON "vendors"("business_id");

-- ── Seed platform permission catalogue ───────────────────────────────────────
INSERT INTO "permissions" ("permission_key", "description") VALUES
  ('business.read',              'View business profile and settings'),
  ('business.update',            'Edit business profile'),
  ('business.members.manage',    'Invite and remove business members'),
  ('branch.read',                'View branches'),
  ('branch.create',              'Create branches'),
  ('branch.update',              'Edit branches'),
  ('inventory.read',             'View stock levels'),
  ('inventory.adjust',           'Adjust stock manually'),
  ('pos.sale.create',            'Create a point-of-sale sale'),
  ('pos.sale.refund',            'Refund a point-of-sale sale'),
  ('pos.register.close',         'Close and reconcile a cash register'),
  ('finance.read',               'View financial reports'),
  ('finance.expense.create',     'Record expenses'),
  ('orders.read',                'View marketplace orders'),
  ('orders.fulfill',             'Mark orders fulfilled'),
  ('orders.cancel',              'Cancel orders'),
  ('catalog.product.create',     'Create products'),
  ('catalog.product.update',     'Edit products'),
  ('catalog.product.publish',    'Publish and archive products'),
  ('catalog.product.delete',     'Delete products'),
  ('delivery.request.create',    'Create a delivery request'),
  ('subscription.read',          'View subscription and billing'),
  ('subscription.manage',        'Change subscription plan');
