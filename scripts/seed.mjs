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

const courier = {
  id: "00000000-0000-4000-8000-000000000003",
  email: "courier@supplyhub.test",
  name: "Kelvin Mushi",
  agentCode: "AG-DEMO-001",
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
          "subscription.manage",
          "insights.read",
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
  "wholesale.read",
  "wholesale.manage",
  "b2b.rfq.create",
  "b2b.purchase_order.create",
  "b2b.invoice.read",
  "messaging.reply",
  "crm.read",
  "crm.manage",
  "subscription.manage",
  "insights.read",
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
  await upsertUser(courier, "CUSTOMER");

  // Phase 4: a verified, online demo courier so dispatch has an eligible agent.
  await client.query(
    `INSERT INTO delivery_agents (
       id, user_id, agent_code, name, phone, presence, verification, rating,
       completed_trips, latitude, longitude, created_at, updated_at
     )
     VALUES (
       '30000000-0000-4000-8000-000000000001', $1, $2, $3, '+255712345678',
       'ONLINE', 'APPROVED', 4.8, 42, -6.7924, 39.2083, now(), now()
     )
     ON CONFLICT (agent_code) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         presence = 'ONLINE',
         verification = 'APPROVED',
         updated_at = now()`,
    [courier.id, courier.agentCode, courier.name],
  );
  await client.query(
    `INSERT INTO delivery_vehicles (id, agent_id, type, plate, created_at, updated_at)
     VALUES ('31000000-0000-4000-8000-000000000001',
             '30000000-0000-4000-8000-000000000001', 'MOTORCYCLE', 'T-ABC-123', now(), now())
     ON CONFLICT (agent_id) DO NOTHING`,
  );
  await client.query(
    `INSERT INTO agent_service_areas (id, agent_id, label, latitude, longitude, radius_km, created_at)
     VALUES ('32000000-0000-4000-8000-000000000001',
             '30000000-0000-4000-8000-000000000001', 'Dar es Salaam', -6.7924, 39.2083, 25, now())
     ON CONFLICT DO NOTHING`,
  );

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

  // Phase 5: demo wholesale network data.
  const businessIdBySlug = async (slug) => {
    const { rows } = await client.query("SELECT id FROM businesses WHERE slug = $1", [slug]);
    if (!rows[0]) throw new Error(`Missing seeded business: ${slug}`);
    return rows[0].id;
  };
  const productIdBySlug = async (slug) => {
    const { rows } = await client.query("SELECT id FROM products WHERE slug = $1", [slug]);
    if (!rows[0]) throw new Error(`Missing seeded product: ${slug}`);
    return rows[0].id;
  };

  const supplierBusinessId = await businessIdBySlug("atelier-nord-studio");
  const buyerBusinessId = await businessIdBySlug("field-and-form-workshop");
  const supplierVendorId = studios[0].id;
  const buyerOwnerId = studios[1].ownerId;
  const carafeProductId = await productIdBySlug("ridge-carafe");

  const demoListingId = "50000000-0000-4000-8000-000000000001";
  await client.query(
    `INSERT INTO wholesale_listings (
       id, listing_number, vendor_id, business_id, product_id, title, description,
       sku, currency, unit_price, minimum_order, stock_available, lead_time_days,
       status, published_at, created_at, updated_at
     )
     VALUES ($1, 'WL-DEMO-001', $2, $3, $4, 'Ridge carafe — wholesale',
       'Hand-thrown stoneware carafe, sold in studio batches.', 'WL-RIDGE-001',
       'TZS', 85000, 12, 120, 14, 'ACTIVE', now(), now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [demoListingId, supplierVendorId, supplierBusinessId, carafeProductId],
  );
  await client.query(
    `INSERT INTO wholesale_price_tiers (
       id, listing_id, min_qty, max_qty, unit_price, created_at
     )
     VALUES ('50000000-0000-4000-8000-000000000002', $1, 24, 59, 78000, now())
     ON CONFLICT (id) DO NOTHING`,
    [demoListingId],
  );
  await client.query(
    `INSERT INTO wholesale_price_tiers (
       id, listing_id, min_qty, max_qty, unit_price, created_at
     )
     VALUES ('50000000-0000-4000-8000-000000000003', $1, 60, NULL, 72000, now())
     ON CONFLICT (id) DO NOTHING`,
    [demoListingId],
  );

  const demoRfqId = "50000000-0000-4000-8000-000000000010";
  await client.query(
    `INSERT INTO rfqs (
       id, rfq_number, buyer_business_id, supplier_vendor_id, submitted_by_id,
       status, currency, note, target_date, submitted_at, created_at, updated_at
     )
     VALUES ($1, 'RFQ-DEMO-001', $2, $3, $4, 'QUOTED', 'TZS',
       'Please quote for our stockroom reorder.', now() + interval '30 days', now(), now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [demoRfqId, buyerBusinessId, supplierVendorId, buyerOwnerId],
  );
  await client.query(
    `INSERT INTO rfq_items (
       id, rfq_id, listing_id, product_name, sku, quantity, unit, target_price, created_at
     )
     VALUES ('50000000-0000-4000-8000-000000000011', $1, $2,
       'Ridge carafe', 'WL-RIDGE-001', 24, 'each', 80000, now())
     ON CONFLICT (id) DO NOTHING`,
    [demoRfqId, demoListingId],
  );

  const demoQuotationId = "50000000-0000-4000-8000-000000000020";
  await client.query(
    `INSERT INTO supplier_quotations (
       id, quotation_number, rfq_id, supplier_vendor_id, business_id, status,
       currency, subtotal, note, valid_until, sent_at, created_at, updated_at
     )
     VALUES ($1, 'QT-DEMO-001', $2, $3, $4, 'SENT', 'TZS', 1872000,
       'Volume price applied at 24 units.', now() + interval '14 days', now(), now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [demoQuotationId, demoRfqId, supplierVendorId, supplierBusinessId],
  );
  await client.query(
    `INSERT INTO quotation_items (
       id, quotation_id, rfq_item_id, product_name, sku, quantity,
       unit_price, line_total, currency, created_at
     )
     VALUES ('50000000-0000-4000-8000-000000000021', $1,
       '50000000-0000-4000-8000-000000000011', 'Ridge carafe', 'WL-RIDGE-001',
       24, 78000, 1872000, 'TZS', now())
     ON CONFLICT (id) DO NOTHING`,
    [demoQuotationId],
  );

  const demoPoId = "50000000-0000-4000-8000-000000000030";
  await client.query(
    `INSERT INTO business_purchase_orders (
       id, po_number, business_id, supplier_vendor_id, quotation_id, submitted_by_id,
       status, currency, subtotal, tax_total, shipping_total, total, note,
       ordered_at, created_at, updated_at
     )
     VALUES ($1, 'PO-DEMO-001', $2, $3, $4, $5, 'SHIPPED', 'TZS',
       1872000, 0, 50000, 1922000, 'Stockroom reorder.', now(), now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [demoPoId, buyerBusinessId, supplierVendorId, demoQuotationId, buyerOwnerId],
  );
  await client.query(
    `INSERT INTO business_purchase_order_items (
       id, purchase_order_id, listing_id, product_name, sku, quantity,
       unit_price, line_total, currency, created_at
     )
     VALUES ('50000000-0000-4000-8000-000000000031', $1, $2,
       'Ridge carafe', 'WL-RIDGE-001', 24, 78000, 1872000, 'TZS', now())
     ON CONFLICT (id) DO NOTHING`,
    [demoPoId, demoListingId],
  );

  await client.query(
    `INSERT INTO business_invoices (
       id, invoice_number, purchase_order_id, business_id, supplier_vendor_id,
       status, currency, subtotal, tax_total, total, amount_paid, issued_at,
       created_at, updated_at
     )
     VALUES ('50000000-0000-4000-8000-000000000040', 'INV-DEMO-001', $1, $2, $3,
       'ISSUED', 'TZS', 1872000, 0, 1922000, 0, now(), now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [demoPoId, buyerBusinessId, supplierVendorId],
  );
  await client.query(
    `INSERT INTO business_invoice_items (
       id, invoice_id, description, quantity, unit_price, line_total, currency, created_at
     )
     VALUES ('50000000-0000-4000-8000-000000000041',
       '50000000-0000-4000-8000-000000000040', 'Ridge carafe',
       24, 78000, 1872000, 'TZS', now())
     ON CONFLICT (id) DO NOTHING`,
  );

  // Phase 6: one real buyer ↔ studio conversation for the demo accounts.
  const demoChatId = "60000000-0000-4000-8000-000000000001";
  await client.query(
    `INSERT INTO chats (
       id, buyer_id, vendor_id, product_id, last_message_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, '40000000-0000-4000-8000-000000000001',
       now() - interval '3 minutes', now() - interval '1 day', now() - interval '3 minutes')
     ON CONFLICT (id) DO NOTHING`,
    [demoChatId, customer.id, studios[0].id],
  );
  await client.query(
    `INSERT INTO chat_messages (id, chat_id, sender_id, body, read_at, created_at)
     VALUES
       ('60000000-0000-4000-8000-000000000011', $1, $2,
        'Hello! Is the ridge carafe available in the speckled glaze?',
        now() - interval '1 day', now() - interval '1 day'),
       ('60000000-0000-4000-8000-000000000012', $1, $3,
        'Yes — we have six in that glaze ready to ship.',
        now() - interval '20 hours', now() - interval '20 hours'),
       ('60000000-0000-4000-8000-000000000013', $1, $3,
        'Absolutely — tell me your preferred glaze and I will reserve one.',
        null, now() - interval '3 minutes')
     ON CONFLICT (id) DO UPDATE SET
       sender_id = EXCLUDED.sender_id,
       body = EXCLUDED.body,
       read_at = EXCLUDED.read_at`,
    [demoChatId, customer.id, studios[0].ownerId],
  );

  // Phase 6: CRM records and a loyalty ledger for the demo buyer.
  const demoLoyaltyAccountId = "80000000-0000-4000-8000-000000000001";
  await client.query(
    `INSERT INTO loyalty_accounts (
       id, user_id, points_balance, lifetime_points, tier, created_at, updated_at
     )
     VALUES ($1, $2, 2400, 3400, 'SILVER', now() - interval '2 months', now())
     ON CONFLICT (user_id) DO UPDATE SET
       points_balance = EXCLUDED.points_balance,
       lifetime_points = EXCLUDED.lifetime_points,
       tier = EXCLUDED.tier`,
    [demoLoyaltyAccountId, customer.id],
  );
  await client.query(
    `INSERT INTO loyalty_transactions (
       id, account_id, type, points, balance_after, reference_type, reference_id,
       description, created_at
     )
     VALUES
       ('80000000-0000-4000-8000-000000000011', $1, 'EARNED_PURCHASE', 1800, 1800,
        'order', 'LOYD-DEMO-001', 'Points earned from a delivered order.', now() - interval '50 days'),
       ('80000000-0000-4000-8000-000000000012', $1, 'EARNED_PURCHASE', 1600, 3400,
        'order', 'LOYD-DEMO-002', 'Points earned from a delivered order.', now() - interval '20 days'),
       ('80000000-0000-4000-8000-000000000013', $1, 'REDEEMED_REWARD', -500, 2900,
        'coupon', 'LOYC-DEMO-001', 'Redeemed for a checkout reward.', now() - interval '10 days'),
       ('80000000-0000-4000-8000-000000000014', $1, 'REDEEMED_REWARD', -500, 2400,
        'coupon', 'LOYC-DEMO-002', 'Redeemed for a checkout reward.', now() - interval '2 days')
     ON CONFLICT (id) DO NOTHING`,
    [demoLoyaltyAccountId],
  );

  for (const [index, studio] of studios.entries()) {
    await client.query(
      `INSERT INTO customers (
         id, vendor_id, user_id, segment, note, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, now() - interval '30 days', now())
       ON CONFLICT (vendor_id, user_id) DO UPDATE SET
         segment = EXCLUDED.segment,
         note = EXCLUDED.note`,
      [
        `90000000-0000-4000-8000-00000000000${index + 1}`,
        studio.id,
        customer.id,
        index === 0 ? "VIP" : index === 1 ? "RETURNING" : "NEW",
        index === 0
          ? "Prefers speckled glazes. Follow up when new ceramics arrive."
          : index === 1
            ? "Regular stockroom buyer; asks for volume tiers."
            : "First contact via studio chat.",
      ],
    );
  }

  // Phase 6: subscription plans, a business subscription and its invoice.
  const demoSubscriptionPlans = [
    {
      id: "b0000000-0000-4000-8000-000000000001",
      code: "starter",
      name: "Starter",
      description: "For small buying teams that need the core B2B workspace.",
      priceMonthly: 15000,
      includedSeats: 3,
      seatLimit: 10,
      features: ["Wholesale catalog", "RFQs and quotations", "Email support"],
      sortOrder: 1,
    },
    {
      id: "b0000000-0000-4000-8000-000000000002",
      code: "growth",
      name: "Growth",
      description: "For businesses running regular purchasing and fulfillment.",
      priceMonthly: 35000,
      includedSeats: 10,
      seatLimit: 50,
      features: ["Everything in Starter", "Purchase orders", "Priority support", "CRM seats"],
      sortOrder: 2,
    },
    {
      id: "b0000000-0000-4000-8000-000000000003",
      code: "enterprise",
      name: "Enterprise",
      description: "For larger procurement teams with wider seat requirements.",
      priceMonthly: 75000,
      includedSeats: 25,
      seatLimit: 200,
      features: ["Everything in Growth", "Dedicated onboarding", "Custom reporting"],
      sortOrder: 3,
    },
  ];

  for (const plan of demoSubscriptionPlans) {
    await client.query(
      `INSERT INTO subscription_plans (
         id, code, name, description, price_monthly, currency, included_seats, seat_limit,
         features, status, sort_order, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, 'TZS', $6, $7, $8::jsonb, 'ACTIVE', $9,
         now() - interval '60 days', now())
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         price_monthly = EXCLUDED.price_monthly,
         included_seats = EXCLUDED.included_seats,
         seat_limit = EXCLUDED.seat_limit,
         features = EXCLUDED.features,
         status = EXCLUDED.status,
         sort_order = EXCLUDED.sort_order,
         updated_at = now()`,
      [
        plan.id,
        plan.code,
        plan.name,
        plan.description,
        plan.priceMonthly,
        plan.includedSeats,
        plan.seatLimit,
        JSON.stringify(plan.features),
        plan.sortOrder,
      ],
    );
  }

  const demoSubscriptionBusinessId = await businessIdBySlug("atelier-nord-studio");
  const demoSubscriptionId = "b0000000-0000-4000-8000-000000000101";
  await client.query(
    `INSERT INTO business_subscriptions (
       id, business_id, plan_id, status, seats, current_period_start, current_period_end,
       created_at, updated_at
     )
     VALUES ($1, $2, $3, 'ACTIVE', 12, now() - interval '12 days', now() + interval '18 days',
       now() - interval '12 days', now())
     ON CONFLICT (business_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       seats = EXCLUDED.seats,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = now()`,
    [demoSubscriptionId, demoSubscriptionBusinessId, demoSubscriptionPlans[1].id],
  );

  await client.query(
    `INSERT INTO subscription_invoices (
       id, invoice_number, subscription_id, status, currency, subtotal, tax_total, total,
       amount_paid, period_start, period_end, issued_at, due_at, paid_at, created_at, updated_at
     )
     VALUES ($1, 'SUBINV-DEMO-001', $2, 'ISSUED', 'TZS', 70000, 0, 70000, 0,
       now() - interval '12 days', now() + interval '18 days', now() - interval '12 days',
       now() + interval '5 days', null, now() - interval '12 days', now())
     ON CONFLICT (invoice_number) DO UPDATE SET
       subscription_id = EXCLUDED.subscription_id,
       status = EXCLUDED.status,
       subtotal = EXCLUDED.subtotal,
       total = EXCLUDED.total,
       amount_paid = EXCLUDED.amount_paid,
       period_start = EXCLUDED.period_start,
       period_end = EXCLUDED.period_end,
       issued_at = EXCLUDED.issued_at,
       due_at = EXCLUDED.due_at,
       updated_at = now()`,
    [demoSubscriptionId, demoSubscriptionId],
  );

  // Phase 4: documented default delivery pricing (TZS).
  await client.query(
    `INSERT INTO delivery_pricing_rules (
       id, name, currency, base_fee, per_km_rate, minimum_fee, maximum_fee,
       is_active, created_at, updated_at
     )
     VALUES (gen_random_uuid(), 'TZS default', 'TZS', 5000, 2000, 5000, 50000, true, now(), now())
     ON CONFLICT DO NOTHING`,
  );

  await client.query("COMMIT");

  console.log("Seeded SupplyHub demo catalog.");
  console.log(`  Admin:    ${admin.email} / ${DEMO_PASSWORD}`);
  console.log(`  Customer: ${customer.email} / ${DEMO_PASSWORD}`);
  console.log(`  Courier:  ${courier.email} / ${DEMO_PASSWORD}`);
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
