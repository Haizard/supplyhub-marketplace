import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";

import { hash } from "@node-rs/argon2";
import { Client } from "pg";

const DEMO_PASSWORD = "SupplyHub!2026";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set. Run this with an .env file that defines it.");
  process.exit(1);
}

const uploadRoot = path.join(process.cwd(), ".local", "uploads");
const demoImageRoot = path.join(process.cwd(), "public", "images", "demo");

const admin = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@supplyhub.test",
  name: "SupplyHub Admin",
};

const customer = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "customer@supplyhub.test",
  name: "Mara Ellison",
};

const studios = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    ownerId: "20000000-0000-4000-8000-000000000001",
    email: "studio@atelier-nord.test",
    ownerName: "Ingrid Halvorsen",
    name: "Atelier Nord",
    slug: "atelier-nord",
    monogram: "AN",
    location: "Portland, Oregon",
    discipline: "Ceramics",
    description:
      "A two-wheel studio working in speckled stoneware and quiet glazes. Each piece is thrown in small batches, trimmed by hand, and fired twice.",
    story:
      "A two-wheel studio working in speckled stoneware and quiet glazes. Each piece is thrown in small batches, trimmed by hand, and fired twice. The ridges and thumb marks are left visible on purpose.",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    ownerId: "20000000-0000-4000-8000-000000000002",
    email: "studio@field-and-form.test",
    ownerName: "Owen Beck",
    name: "Field & Form",
    slug: "field-and-form",
    monogram: "FF",
    location: "Austin, Texas",
    discipline: "Leather goods",
    description:
      "Vegetable-tanned hides cut and stitched in small runs. Every piece darkens and softens with use.",
    story:
      "Field & Form cuts vegetable-tanned hides in a small workshop and finishes every edge by hand. The studio favors simple shapes, saddle stitching, and hardware that can be repaired rather than replaced.",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    ownerId: "20000000-0000-4000-8000-000000000003",
    email: "studio@loom-house.test",
    ownerName: "Naomi Reyes",
    name: "Loom House",
    slug: "loom-house",
    monogram: "LH",
    location: "Asheville, North Carolina",
    discipline: "Textiles",
    description:
      "Weaving in flax, cotton, and natural indigo. Cloth is washed and softened in small batches before it reaches a home.",
    story:
      "A weaving studio focused on flax, cotton, and natural indigo. Cloth is washed and softened in small batches, so the weave relaxes before it reaches a home. Slight irregularity is part of the finish.",
  },
];

const categories = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    slug: "ceramics",
    name: "Ceramics",
    headline: "Vessels for the daily ritual",
    description:
      "Wheel-thrown and hand-built pieces with visible evidence of the hand. Made to be used, not shelved.",
    sortOrder: 0,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    slug: "leather",
    name: "Leather goods",
    headline: "Carried, patinated, kept",
    description:
      "Vegetable-tanned hides cut and stitched in small runs. Every piece darkens and softens with use.",
    sortOrder: 1,
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    slug: "textiles",
    name: "Textiles",
    headline: "Cloth with a longer memory",
    description:
      "Woven and naturally dyed in independent studios. Substantial enough for daily life, soft enough to live with.",
    sortOrder: 2,
  },
];

const products = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    slug: "ridge-carafe",
    name: "Ridge Carafe",
    vendorSlug: "atelier-nord",
    categorySlug: "ceramics",
    price: "185000.00",
    compareAtPrice: null,
    stock: 8,
    featured: true,
    publishedAt: "2026-10-24T12:00:00.000Z",
    summary: "A speckled stoneware carafe with a matte oat glaze and one deliberate ridge.",
    description:
      "Thrown on the wheel, trimmed, and dipped in a soft oat glaze that breaks over the ridge. The short pinched spout pours cleanly and the unglazed foot keeps the base grounded. Sized for water on a table or stems from the market.",
    makerNote:
      "The ridge is one pass of the thumb while the clay is still soft. The glaze catches it, so the line shows up again after firing.",
    materials: ["Speckled stoneware", "Food-safe matte glaze"],
    dimensions: "8.5 in tall × 4 in wide · 34 fl oz",
    care: "Hand wash and dry fully. Avoid sudden temperature changes.",
    image: {
      name: "ridge-carafe.jpg",
      alt: "A pale speckled stoneware carafe with a pinched spout photographed against a limestone wall.",
      id: "50000000-0000-4000-8000-000000000001",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    slug: "kiln-cups",
    name: "Kiln Cup Set",
    vendorSlug: "atelier-nord",
    categorySlug: "ceramics",
    price: "115000.00",
    compareAtPrice: null,
    stock: 12,
    featured: false,
    publishedAt: "2026-10-12T12:00:00.000Z",
    summary: "Two handleless cups, glazed in sand and moss — a pair for slow mornings.",
    description:
      "Thrown as a pair and glazed in two earth tones. The walls are thick enough to hold heat and the rims are left slightly uneven. Use them for espresso, tea, or a small pour of something stronger.",
    makerNote:
      "The cups are thrown from the same clay batch, then glazed separately so the pair reads as related rather than identical.",
    materials: ["Speckled stoneware", "Sand and moss reactive glazes"],
    dimensions: "3 in tall × 3.25 in wide · 8 fl oz each",
    care: "Hand wash recommended. Dishwasher safe on a low-heat cycle.",
    image: {
      name: "kiln-cups.jpg",
      alt: "Two handleless stoneware cups, one sand-glazed and one moss-glazed, on a warm plaster surface.",
      id: "50000000-0000-4000-8000-000000000002",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    slug: "everyday-tote",
    name: "Everyday Tote",
    vendorSlug: "field-and-form",
    categorySlug: "leather",
    price: "495000.00",
    compareAtPrice: null,
    stock: 3,
    featured: true,
    publishedAt: "2026-10-30T12:00:00.000Z",
    summary: "A structured vegetable-tanned leather tote with flat handles and an open top.",
    description:
      "Cut from a single hide and saddle-stitched at the stress points. The body is left unlined so the leather can age openly, and the flat handles sit comfortably over a shoulder. Holds a laptop, a book, and the rest of a working day.",
    makerNote:
      "We cut around the strongest part of the hide and let the natural creases stay. The bag will take on the shape of how you carry it.",
    materials: ["Vegetable-tanned leather", "Waxed cotton thread"],
    dimensions: "14.5 in wide × 12 in tall × 4.5 in deep · 10 in handle drop",
    care: "Store upright away from direct sun. Condition lightly once a year.",
    image: {
      name: "everyday-tote.jpg",
      alt: "A tan leather tote with two flat handles standing upright against a limestone backdrop.",
      id: "50000000-0000-4000-8000-000000000003",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    slug: "card-sleeve",
    name: "Card Sleeve",
    vendorSlug: "field-and-form",
    categorySlug: "leather",
    price: "155000.00",
    compareAtPrice: null,
    stock: 0,
    featured: false,
    publishedAt: "2026-09-28T12:00:00.000Z",
    summary: "Four card pockets, one piece of cognac leather, and a full-length saddle stitch.",
    description:
      "A slim sleeve cut from a single piece of leather and folded rather than glued. Four pockets hold cards and a folded bill; the center slot takes a sixth card. Burnished edges and waxed thread keep it working for years.",
    makerNote:
      "Every edge is sanded, burnished, and waxed by hand before stitching. The sleeve starts stiff and ends up shaped to your pocket.",
    materials: ["Vegetable-tanned leather", "Waxed linen thread"],
    dimensions: "4.1 in wide × 2.9 in tall · 6 card capacity",
    care: "Wipe with a dry cloth. Avoid soaking; leather will darken with use.",
    image: {
      name: "card-sleeve.jpg",
      alt: "A cognac leather card sleeve with four card pockets and visible saddle stitching.",
      id: "50000000-0000-4000-8000-000000000004",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    slug: "linen-throw",
    name: "Linen Throw",
    vendorSlug: "loom-house",
    categorySlug: "textiles",
    price: "320000.00",
    compareAtPrice: "385000.00",
    stock: 6,
    featured: true,
    publishedAt: "2026-10-18T12:00:00.000Z",
    summary:
      "A stonewashed linen throw in undyed oatmeal, woven with a soft hand and a fringe edge.",
    description:
      "Woven from European flax, then washed and tumbled until the weave relaxes. The oatmeal color is undyed, so the natural variation in the yarn stays visible. Warm enough for a chair, light enough for a bed in summer.",
    makerNote:
      "The fringe is twisted by hand after the cloth comes off the loom. No two throws have exactly the same edge.",
    materials: ["100% European flax linen"],
    dimensions: "50 in × 70 in · hand-twisted fringe",
    care: "Machine wash cold on a gentle cycle. Line dry; do not bleach.",
    image: {
      name: "linen-throw.jpg",
      alt: "An oatmeal linen throw folded into a soft stack with a fringed edge on a plaster surface.",
      id: "50000000-0000-4000-8000-000000000005",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000006",
    slug: "market-apron",
    name: "Market Apron",
    vendorSlug: "loom-house",
    categorySlug: "textiles",
    price: "195000.00",
    compareAtPrice: null,
    stock: 5,
    featured: false,
    publishedAt: "2026-10-08T12:00:00.000Z",
    summary: "Indigo-dyed cotton canvas with cross-back straps and a deep divided pocket.",
    description:
      "A working apron cut from midweight cotton canvas and dyed in small indigo baths. The cross-back straps keep weight off the neck, and the divided front pocket holds a notebook, pencils, and a phone. The dye will fade unevenly with washing and wear.",
    makerNote:
      "Each dip in the indigo bath shifts the blue. We leave the variation in rather than matching every apron to a single shade.",
    materials: ["Midweight cotton canvas", "Natural indigo dye"],
    dimensions: "One size · 32 in length · adjustable cross-back straps",
    care: "Machine wash cold with like colors. Expect indigo to soften over time.",
    image: {
      name: "market-apron.jpg",
      alt: "An indigo-dyed canvas apron with crossed back straps and a large front pocket hanging on a wooden peg.",
      id: "50000000-0000-4000-8000-000000000006",
    },
  },
];

const businessCategories = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    slug: "craft-and-home",
    name: "Craft & Home",
    sortOrder: 0,
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    slug: "fashion-and-textiles",
    name: "Fashion & Textiles",
    sortOrder: 1,
  },
];

const demoBusinesses = [
  {
    businessCode: "BIZ-AN01",
    name: "Atelier Nord Studio",
    slug: "atelier-nord-studio",
    verificationStatus: "verified",
    vendorId: "10000000-0000-4000-8000-000000000001",
    categorySlug: "craft-and-home",
    description:
      "The business behind Atelier Nord: one studio, two locations, and the team that throws, glazes, and ships every piece.",
    website: "https://atelier-nord.example.com",
    contactPhone: "+1 503 555 0142",
    contactEmail: "studio@atelier-nord.test",
    branches: [
      {
        name: "Portland Studio",
        branchCode: "MAIN",
        address: "412 SE Division St",
        city: "Portland",
        latitude: "45.5045000",
        longitude: "-122.6543000",
        isPrimary: true,
      },
      {
        name: "Seattle Outpost",
        branchCode: "SEA",
        address: "88 Pike St",
        city: "Seattle",
        latitude: "47.6097000",
        longitude: "-122.3331000",
        isPrimary: false,
      },
    ],
    customRoles: [
      {
        name: "Operations manager",
        permissionKeys: [
          "business.read",
          "branch.read",
          "inventory.read",
          "inventory.adjust",
          "orders.read",
          "orders.fulfill",
          "catalog.product.create",
          "catalog.product.update",
          "catalog.product.publish",
          "delivery.request.create",
          "pos.sale.create",
          "pos.register.close",
        ],
      },
      {
        name: "Bookkeeper",
        permissionKeys: [
          "business.read",
          "finance.read",
          "finance.expense.create",
          "subscription.read",
        ],
      },
    ],
    members: [{ userId: customer.id, roleName: "Operations manager" }],
  },
  {
    businessCode: "BIZ-FF02",
    name: "Field & Form Workshop",
    slug: "field-and-form-workshop",
    verificationStatus: "verified",
    vendorId: "10000000-0000-4000-8000-000000000002",
    categorySlug: "fashion-and-textiles",
    description:
      "Cutting benches, an edge-painting station, and the two people who keep Field & Form's leather work moving.",
    website: "https://field-and-form.example.com",
    contactPhone: "+1 512 555 0198",
    contactEmail: "studio@field-and-form.test",
    branches: [
      {
        name: "Austin Workshop",
        branchCode: "MAIN",
        address: "1704 E 6th St",
        city: "Austin",
        latitude: "30.2654000",
        longitude: "-97.7283000",
        isPrimary: true,
      },
    ],
    customRoles: [
      {
        name: "Catalog editor",
        permissionKeys: [
          "business.read",
          "branch.read",
          "inventory.read",
          "catalog.product.create",
          "catalog.product.update",
          "catalog.product.publish",
        ],
      },
    ],
    members: [{ userId: "20000000-0000-4000-8000-000000000001", roleName: "Catalog editor" }],
  },
  {
    businessCode: "BIZ-LH03",
    name: "Loom House Mill",
    slug: "loom-house-mill",
    verificationStatus: "pending",
    vendorId: "10000000-0000-4000-8000-000000000003",
    categorySlug: "fashion-and-textiles",
    description:
      "Looms, dye vats, and a stockroom in Charlotte. Verification is still under review, so the profile shows as pending.",
    website: "https://loom-house.example.com",
    contactPhone: "+1 828 555 0177",
    contactEmail: "studio@loom-house.test",
    branches: [
      {
        name: "Asheville Mill",
        branchCode: "MAIN",
        address: "31 Clingman Ave",
        city: "Asheville",
        latitude: "35.5842000",
        longitude: "-82.5637000",
        isPrimary: true,
      },
      {
        name: "Charlotte Stockroom",
        branchCode: "CLT",
        address: "1200 S Mint St",
        city: "Charlotte",
        latitude: "35.2197000",
        longitude: "-80.8569000",
        isPrimary: false,
      },
    ],
    customRoles: [
      {
        name: "Catalog editor",
        permissionKeys: [
          "business.read",
          "branch.read",
          "inventory.read",
          "catalog.product.create",
          "catalog.product.update",
          "catalog.product.publish",
        ],
      },
      {
        name: "Fulfilment lead",
        permissionKeys: [
          "business.read",
          "branch.read",
          "inventory.read",
          "orders.read",
          "orders.fulfill",
          "delivery.request.create",
        ],
      },
    ],
    members: [
      { userId: "20000000-0000-4000-8000-000000000002", roleName: "Catalog editor" },
      { userId: "20000000-0000-4000-8000-000000000001", roleName: "Fulfilment lead" },
    ],
  },
];

const demoStaffPermissionKeys = [
  "business.read",
  "branch.read",
  "inventory.read",
  "orders.read",
  "orders.fulfill",
  "catalog.product.create",
  "catalog.product.update",
  "catalog.product.publish",
];

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function searchTextFor(product) {
  return normalize(
    [
      product.name,
      product.summary,
      product.description,
      product.makerNote,
      product.materials.join(" "),
      product.dimensions,
    ].join(" "),
  ).slice(0, 8000);
}

const studioBySlug = new Map(studios.map((studio) => [studio.slug, studio]));
const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

const client = new Client({ connectionString });
const passwordHash = await hash(DEMO_PASSWORD);

try {
  await client.connect();
  await client.query("BEGIN");

  const upsertUser = async (user, role) => {
    await client.query(
      `INSERT INTO users (
         id, email, name, password_hash, email_verified_at, role, status, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, now(), $5, 'ACTIVE', now(), now())
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           email_verified_at = now(),
           role = EXCLUDED.role,
           status = 'ACTIVE',
           updated_at = now()`,
      [user.id, user.email, user.name, passwordHash, role],
    );
  };

  await upsertUser(admin, "ADMIN");
  await upsertUser(customer, "CUSTOMER");

  for (const studio of studios) {
    await upsertUser({ id: studio.ownerId, email: studio.email, name: studio.ownerName }, "VENDOR");

    await client.query(
      `INSERT INTO vendors (
         id, owner_id, name, slug, description, monogram, location, discipline, story,
         status, reviewed_at, reviewed_by_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED', now(), $10, now(), now())
       ON CONFLICT (slug) DO UPDATE
       SET owner_id = EXCLUDED.owner_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           monogram = EXCLUDED.monogram,
           location = EXCLUDED.location,
           discipline = EXCLUDED.discipline,
           story = EXCLUDED.story,
           status = 'APPROVED',
           reviewed_at = now(),
           reviewed_by_id = EXCLUDED.reviewed_by_id,
           updated_at = now()`,
      [
        studio.id,
        studio.ownerId,
        studio.name,
        studio.slug,
        studio.description,
        studio.monogram,
        studio.location,
        studio.discipline,
        studio.story,
        admin.id,
      ],
    );
  }

  for (const category of categories) {
    await client.query(
      `INSERT INTO categories (
         id, name, slug, headline, description, status, sort_order, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, now(), now())
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           headline = EXCLUDED.headline,
           description = EXCLUDED.description,
           status = 'ACTIVE',
           sort_order = EXCLUDED.sort_order,
           updated_at = now()`,
      [
        category.id,
        category.name,
        category.slug,
        category.headline,
        category.description,
        category.sortOrder,
      ],
    );
  }

  for (const product of products) {
    const studio = studioBySlug.get(product.vendorSlug);
    const category = categoryBySlug.get(product.categorySlug);

    await client.query(
      `INSERT INTO products (
         id, vendor_id, category_id, slug, name, sku, summary, description, maker_note,
         materials, dimensions, care, search_text, price, compare_at_price, currency,
         stock, status, featured, reviewed_at, reviewed_by_id, submitted_at, published_at,
         created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, 'TZS',
         $16, 'PUBLISHED', $17, $18, $19, $18, $18,
         now(), now()
       )
       ON CONFLICT (slug) DO UPDATE
       SET vendor_id = EXCLUDED.vendor_id,
           category_id = EXCLUDED.category_id,
           name = EXCLUDED.name,
           sku = EXCLUDED.sku,
           summary = EXCLUDED.summary,
           description = EXCLUDED.description,
           maker_note = EXCLUDED.maker_note,
           materials = EXCLUDED.materials,
           dimensions = EXCLUDED.dimensions,
           care = EXCLUDED.care,
           search_text = EXCLUDED.search_text,
           price = EXCLUDED.price,
           compare_at_price = EXCLUDED.compare_at_price,
           currency = EXCLUDED.currency,
           stock = EXCLUDED.stock,
           status = 'PUBLISHED',
           featured = EXCLUDED.featured,
           reviewed_at = EXCLUDED.reviewed_at,
           reviewed_by_id = EXCLUDED.reviewed_by_id,
           published_at = EXCLUDED.published_at,
           archived_at = NULL,
           updated_at = now()`,
      [
        product.id,
        studio.id,
        category.id,
        product.slug,
        product.name,
        `SH-${product.slug.replaceAll("-", "").toUpperCase().slice(0, 16)}`,
        product.summary,
        product.description,
        product.makerNote,
        product.materials,
        product.dimensions,
        product.care,
        searchTextFor(product),
        product.price,
        product.compareAtPrice,
        product.stock,
        product.featured,
        product.publishedAt,
        admin.id,
      ],
    );

    const source = path.join(demoImageRoot, product.image.name);
    const storageKey = `products/${product.id}/${product.image.id}.jpg`;
    const destination = path.join(uploadRoot, "products", product.id, `${product.image.id}.jpg`);

    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    const file = await stat(destination);

    await client.query(
      `INSERT INTO product_images (
         id, product_id, storage_key, alt, content_type, byte_size, sort_order, status
       )
       VALUES ($1, $2, $3, $4, 'image/jpeg', $5, 0, 'APPROVED')
       ON CONFLICT (storage_key) DO UPDATE
       SET alt = EXCLUDED.alt,
           content_type = EXCLUDED.content_type,
           byte_size = EXCLUDED.byte_size,
           status = 'APPROVED'`,
      [product.image.id, product.id, storageKey, product.image.alt, file.size],
    );

    await client.query(
      `INSERT INTO inventory_movements (
         id, product_id, actor_id, delta, reason, resulting_stock, note
       )
       VALUES ($1, $2, $3, $4, 'INITIAL', $4, 'Initial stock recorded by the demo seed.')
       ON CONFLICT (id) DO UPDATE
       SET delta = EXCLUDED.delta,
           resulting_stock = EXCLUDED.resulting_stock`,
      [
        `60000000-0000-4000-8000-${product.id.slice(-12)}`,
        product.id,
        studio.ownerId,
        product.stock,
      ],
    );
  }

  // ── Demo businesses (business identity) ──────────────────────────────────
  const permissionRows = (await client.query("SELECT id, permission_key FROM permissions")).rows;
  const permissionIdByKey = new Map(permissionRows.map((row) => [row.permission_key, row.id]));

  const grantPermissions = async (roleId, keys) => {
    await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);
    const permissionIds = keys.map((key) => {
      const id = permissionIdByKey.get(key);
      if (!id) throw new Error(`Unknown permission key in seed: ${key}`);
      return id;
    });
    if (permissionIds.length === 0) return;
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [roleId, permissionIds],
    );
  };

  const upsertRole = async (businessId, name, permissionKeys, isSystem) => {
    const { rows } = await client.query(
      `INSERT INTO business_roles (business_id, name, is_system, created_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (business_id, name) DO UPDATE
       SET is_system = EXCLUDED.is_system
       RETURNING id`,
      [businessId, name, isSystem],
    );
    await grantPermissions(rows[0].id, permissionKeys);
    return rows[0].id;
  };

  const upsertMember = async (businessId, userId, invitedById) => {
    const { rows } = await client.query(
      `INSERT INTO business_members (business_id, user_id, status, invited_by, created_at, updated_at)
       VALUES ($1, $2, 'active', $3, now(), now())
       ON CONFLICT (business_id, user_id) DO UPDATE
       SET status = 'active',
           updated_at = now()
       RETURNING id`,
      [businessId, userId, invitedById],
    );
    return rows[0].id;
  };

  const assignRole = async (memberId, roleId) => {
    await client.query(
      `INSERT INTO member_roles (member_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [memberId, roleId],
    );
  };

  for (const category of businessCategories) {
    await client.query(
      `INSERT INTO business_categories (id, name, slug, sort_order, created_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           sort_order = EXCLUDED.sort_order`,
      [category.id, category.name, category.slug, category.sortOrder],
    );
  }

  for (const business of demoBusinesses) {
    const studio = studios.find((entry) => entry.id === business.vendorId);
    const category = businessCategories.find((entry) => entry.slug === business.categorySlug);

    const { rows: businessRows } = await client.query(
      `INSERT INTO businesses (
         business_code, name, slug, category_id, verification_status, description,
         website, contact_phone, contact_email, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       ON CONFLICT (slug) DO UPDATE
       SET business_code = EXCLUDED.business_code,
           name = EXCLUDED.name,
           category_id = EXCLUDED.category_id,
           verification_status = EXCLUDED.verification_status,
           description = EXCLUDED.description,
           website = EXCLUDED.website,
           contact_phone = EXCLUDED.contact_phone,
           contact_email = EXCLUDED.contact_email,
           updated_at = now()
       RETURNING id`,
      [
        business.businessCode,
        business.name,
        business.slug,
        category ? category.id : null,
        business.verificationStatus,
        business.description,
        business.website,
        business.contactPhone,
        business.contactEmail,
      ],
    );
    const businessId = businessRows[0].id;

    // Backfill the vendor → business link the phase 1 schema left nullable.
    await client.query("UPDATE vendors SET business_id = $1, updated_at = now() WHERE id = $2", [
      businessId,
      business.vendorId,
    ]);

    await client.query(
      `INSERT INTO business_settings (business_id, settings_json, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (business_id) DO UPDATE
       SET settings_json = EXCLUDED.settings_json,
           updated_at = now()`,
      [businessId, JSON.stringify({ seeded: true, currency: "TZS" })],
    );

    for (const branch of business.branches) {
      await client.query(
        `INSERT INTO business_branches (
           business_id, name, branch_code, address, city, latitude, longitude,
           is_primary, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
         ON CONFLICT (business_id, branch_code) DO UPDATE
         SET name = EXCLUDED.name,
             address = EXCLUDED.address,
             city = EXCLUDED.city,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             is_primary = EXCLUDED.is_primary,
             updated_at = now()`,
        [
          businessId,
          branch.name,
          branch.branchCode,
          branch.address,
          branch.city,
          branch.latitude,
          branch.longitude,
          branch.isPrimary,
        ],
      );
    }

    const ownerRoleId = await upsertRole(
      businessId,
      "owner",
      permissionRows.map((row) => row.permission_key),
      true,
    );
    await upsertRole(businessId, "staff", demoStaffPermissionKeys, true);

    const roleIdsByName = new Map([["owner", ownerRoleId]]);
    for (const role of business.customRoles) {
      roleIdsByName.set(
        role.name,
        await upsertRole(businessId, role.name, role.permissionKeys, false),
      );
    }

    const ownerMemberId = await upsertMember(businessId, studio.ownerId, null);
    await assignRole(ownerMemberId, ownerRoleId);

    for (const member of business.members) {
      const roleId = roleIdsByName.get(member.roleName);
      if (!roleId) throw new Error(`Unknown role in seed: ${member.roleName}`);
      const memberId = await upsertMember(businessId, member.userId, studio.ownerId);
      await assignRole(memberId, roleId);
    }
  }

  await client.query("COMMIT");

  console.log("Seeded SupplyHub demo catalog.");
  console.log(`  Admin:    ${admin.email} / ${DEMO_PASSWORD}`);
  console.log(`  Customer: ${customer.email} / ${DEMO_PASSWORD}`);
  console.log(`  Studios:  ${studios.map((studio) => studio.email).join(", ")}`);
  console.log(
    `  Businesses: ${demoBusinesses.map((business) => `${business.name} (${business.businessCode})`).join(", ")}`,
  );
  console.log(
    "  Business demo: customer@supplyhub.test is Operations manager at Atelier Nord Studio; studio owners cross-join other businesses.",
  );
  console.log(`  Images:   ${products.length} copied to .local/uploads`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
