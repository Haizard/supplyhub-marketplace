/**
 * Idempotent demo-data seeder for every configured marketplace department
 * (`categories`) and business sector (`business_categories`).
 *
 * Run with: node --env-file=.env scripts/seed-all-departments.mjs
 * It only inserts/updates demo rows with deterministic UUIDs; it never deletes data.
 */
import { createHash } from "node:crypto";

import { hash } from "@node-rs/argon2";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Run with: node --env-file=.env scripts/seed-all-departments.mjs",
  );
  process.exit(1);
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "SupplyHub!2026";

function uuid(label) {
  const digest = createHash("sha256").update(`supplyhub:demo:${label}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const client = new Client({ connectionString, connectionTimeoutMillis: 15_000 });
const passwordHash = await hash(DEMO_PASSWORD);

try {
  await client.connect();
  await client.query("BEGIN");

  const { rows: departments } = await client.query(
    `SELECT id, slug, name FROM categories WHERE status = 'ACTIVE' ORDER BY sort_order, name`,
  );
  if (departments.length === 0) throw new Error("No active departments configured.");

  const adminId = uuid("admin");
  const customerId = uuid("customer");
  const courierId = uuid("courier");

  const upsertUser = async (id, email, name, role) => {
    await client.query(
      `INSERT INTO users (id, email, name, password_hash, email_verified_at, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), $5, 'ACTIVE', now(), now())
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
           email_verified_at = now(), status = 'ACTIVE', updated_at = now()`,
      [id, email, name, passwordHash, role],
    );
  };

  await upsertUser(adminId, "admin@supplyhub.test", "SupplyHub Admin", "ADMIN");
  await upsertUser(customerId, "customer@supplyhub.test", "Demo Buyer", "CUSTOMER");
  await upsertUser(courierId, "courier@supplyhub.test", "Demo Courier", "CUSTOMER");

  const { rows: allPermissions } = await client.query("SELECT id FROM permissions");

  for (const [index, department] of departments.entries()) {
    const slug = department.slug;
    const sectorSlug = `sector-${slug}`;
    const sectorId = uuid(`sector:${slug}`);
    const vendorId = uuid(`vendor:${slug}`);
    const ownerId = uuid(`owner:${slug}`);
    const businessId = uuid(`business:${slug}`);
    const warehouseId = uuid(`warehouse:${slug}`);

    const { rows: sectorRows } = await client.query(
      `INSERT INTO business_categories (id, name, slug, sort_order, created_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [sectorId, `${department.name} Sector`, sectorSlug, index],
    );

    await upsertUser(
      ownerId,
      `studio-${slug}@supplyhub.test`,
      `${department.name} Studio Owner`,
      "VENDOR",
    );

    await client.query(
      `INSERT INTO vendors (
         id, owner_id, name, slug, description, monogram, location, discipline, story,
         status, reviewed_at, reviewed_by_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED', now(), $10, now(), now())
       ON CONFLICT (slug) DO UPDATE
       SET owner_id = EXCLUDED.owner_id, name = EXCLUDED.name, description = EXCLUDED.description,
           status = 'APPROVED', reviewed_at = now(), updated_at = now()`,
      [
        vendorId,
        ownerId,
        `${department.name} Studio`,
        `${slug}-studio`,
        `Verified demo studio for the ${department.name} department.`,
        department.name.slice(0, 2).toUpperCase(),
        "Dar es Salaam, Tanzania",
        department.name,
        `Independent supplier in the ${department.name} sector.`,
        adminId,
      ],
    );

    const { rows: businessRows } = await client.query(
      `INSERT INTO businesses (
         id, business_code, name, slug, category_id, verification_status, description,
         contact_email, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, 'verified', $6, $7, now(), now())
       ON CONFLICT (slug) DO UPDATE
       SET business_code = EXCLUDED.business_code, name = EXCLUDED.name,
           category_id = EXCLUDED.category_id, verification_status = 'verified',
           description = EXCLUDED.description, updated_at = now()
       RETURNING id`,
      [
        businessId,
        `SEC-${String(index + 1).padStart(3, "0")}`,
        `${department.name} Supply Co.`,
        `${slug}-supply-co`,
        sectorRows[0].id,
        `Demo business operating in the ${department.name} sector.`,
        `studio-${slug}@supplyhub.test`,
      ],
    );

    await client.query("UPDATE vendors SET business_id = $1, updated_at = now() WHERE id = $2", [
      businessRows[0].id,
      vendorId,
    ]);

    await client.query(
      `INSERT INTO vendor_departments (vendor_id, category_id, created_at)
       VALUES ($1, $2, now()) ON CONFLICT DO NOTHING`,
      [vendorId, department.id],
    );

    const { rows: memberRows } = await client.query(
      `INSERT INTO business_members (business_id, user_id, status, invited_by, created_at, updated_at)
       VALUES ($1, $2, 'active', $3, now(), now())
       ON CONFLICT (business_id, user_id) DO UPDATE SET status = 'active', updated_at = now()
       RETURNING id`,
      [businessRows[0].id, ownerId, adminId],
    );

    const { rows: roleRows } = await client.query(
      `INSERT INTO business_roles (business_id, name, is_system, created_at)
       VALUES ($1, 'owner', true, now())
       ON CONFLICT (business_id, name) DO UPDATE SET is_system = true
       RETURNING id`,
      [businessRows[0].id],
    );
    if (allPermissions.length > 0) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions ON CONFLICT DO NOTHING`,
        [roleRows[0].id],
      );
    }
    await client.query(
      `INSERT INTO member_roles (member_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [memberRows[0].id, roleRows[0].id],
    );

    await client.query(
      `INSERT INTO warehouses (id, vendor_id, name, code, is_default, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, true, now(), now())
       ON CONFLICT (vendor_id, code) DO UPDATE SET name = EXCLUDED.name, is_default = true, is_active = true`,
      [
        warehouseId,
        vendorId,
        `${department.name} Main Store`,
        `MAIN-${String(index + 1).padStart(3, "0")}`,
      ],
    );

    const templates = [
      {
        suffix: "essentials",
        title: `${department.name} Essentials`,
        price: 25_000 + index * 1_500,
      },
      {
        suffix: "starter-kit",
        title: `${department.name} Starter Kit`,
        price: 45_000 + index * 2_000,
      },
    ];

    for (const template of templates) {
      const productId = uuid(`product:${slug}:${template.suffix}`);
      const productSlug = `${slug}-${template.suffix}`;
      const sku = `DEMO-${slug.replaceAll("-", "").slice(0, 10).toUpperCase()}-${template.suffix.slice(0, 3).toUpperCase()}`;
      await client.query(
        `INSERT INTO products (
           id, vendor_id, category_id, slug, name, sku, summary, description, maker_note,
           materials, dimensions, care, search_text, price, compare_at_price, currency,
           stock, status, reviewed_at, reviewed_by_id, submitted_at, published_at,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, 'TZS',
                 100, 'PUBLISHED', now(), $15, now(), now(), now(), now())
         ON CONFLICT (slug) DO UPDATE
         SET vendor_id = EXCLUDED.vendor_id, category_id = EXCLUDED.category_id,
             name = EXCLUDED.name, price = EXCLUDED.price, stock = EXCLUDED.stock,
             status = 'PUBLISHED', published_at = now(), updated_at = now()`,
        [
          productId,
          vendorId,
          department.id,
          productSlug,
          template.title,
          sku,
          `Demo ${department.name.toLowerCase()} product for the ${department.name} department.`,
          `A sample listing used to exercise ${department.name.toLowerCase()} catalogue flows.`,
          "Prepared for the SupplyHub demo dataset.",
          ["See description"],
          "Standard",
          "Standard care",
          `${template.title} ${department.name} demo`,
          template.price,
          adminId,
        ],
      );
      await client.query(
        `INSERT INTO inventory_balances (id, warehouse_id, product_id, quantity, updated_at)
         VALUES ($1, $2, $3, 100, now())
         ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = 100, updated_at = now()`,
        [uuid(`balance:${slug}:${template.suffix}`), warehouseId, productId],
      );
    }
  }

  await client.query("COMMIT");
  console.log(
    `Seeded ${departments.length} departments and ${departments.length} business sectors with users, studios, businesses, warehouses and products.`,
  );
  console.log(`Demo password: ${DEMO_PASSWORD}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
