/**
 * Demo data for the three newer marketplaces: farm produce, logistics and services.
 *
 * Run with: npm run db:seed:marketplaces
 *
 * The script is idempotent — every row has a fixed id (or a stable natural key such
 * as a company code or listing number) and is skipped when it already exists — so it
 * can be re-run after a database reset without duplicating anything.
 */
import { hash } from "@node-rs/argon2";
import { Client } from "pg";

const DEMO_PASSWORD = "SupplyHub!2026";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set. Run this with an .env file that defines it.");
  process.exit(1);
}

const farmers = [
  {
    user: {
      id: "a1000000-0000-4000-8000-000000000001",
      email: "farmer@supplyhub.test",
      name: "Neema Mushi",
    },
    farmer: {
      id: "a2000000-0000-4000-8000-000000000001",
      phone: "+255754110220",
      region: "Mbeya",
      district: "Mbeya Rural",
      ward: "Mbalizi",
      village: "Ihango",
      note: "Smallholder maize, beans, avocado and coffee. Delivers to Mbalizi collection point.",
    },
    farm: {
      id: "a3000000-0000-4000-8000-000000000001",
      name: "Mbalizi Home Farm",
      sizeValue: "4.50",
      sizeUnit: "ACRE",
      waterSource: "Seasonal river + rainwater tank",
      soilInfo: "Volcanic loam, pH 5.8",
    },
    listings: [
      {
        id: "a4000000-0000-4000-8000-000000000001",
        cropName: "Maize",
        variety: "Staha",
        quantity: "8.00",
        unit: "TONNE",
        pricePerUnit: "620000.00",
        minimumOrder: "1.00",
        grade: "Grade A",
        collectionLocation: "Mbalizi collection point, Mbeya",
        coverImageUrl: "/images/marketplace/produce-maize.jpg",
        deliveryAvailable: true,
        organicClaim: false,
        certifiedClaim: false,
        harvestDateDaysAgo: 12,
      },
      {
        id: "a4000000-0000-4000-8000-000000000002",
        cropName: "Beans",
        variety: "Red kidney",
        quantity: "900.00",
        unit: "KG",
        pricePerUnit: "2800.00",
        minimumOrder: "50.00",
        grade: "Grade A",
        collectionLocation: "Mbalizi collection point, Mbeya",
        coverImageUrl: "/images/marketplace/produce-beans.jpg",
        deliveryAvailable: false,
        organicClaim: false,
        certifiedClaim: false,
        harvestDateDaysAgo: 20,
      },
      {
        id: "a4000000-0000-4000-8000-000000000003",
        cropName: "Avocado",
        variety: "Hass",
        quantity: "2400.00",
        unit: "PIECE",
        pricePerUnit: "900.00",
        minimumOrder: "100.00",
        grade: "Export grade",
        collectionLocation: "Mbalizi packhouse, Mbeya",
        coverImageUrl: "/images/marketplace/produce-avocado.jpg",
        deliveryAvailable: true,
        organicClaim: true,
        certifiedClaim: false,
        harvestDateDaysAgo: 3,
      },
      {
        id: "a4000000-0000-4000-8000-000000000004",
        cropName: "Coffee",
        variety: "Arabica parchment",
        quantity: "1200.00",
        unit: "KG",
        pricePerUnit: "8500.00",
        minimumOrder: "60.00",
        grade: "AA",
        collectionLocation: "Mbalizi curing station, Mbeya",
        coverImageUrl: "/images/marketplace/produce-coffee.jpg",
        deliveryAvailable: false,
        organicClaim: false,
        certifiedClaim: false,
        harvestDateDaysAgo: 32,
      },
    ],
  },
];

const buyerRequests = [
  {
    id: "a5000000-0000-4000-8000-000000000001",
    productName: "White maize",
    quantity: "5.00",
    unit: "TONNE",
    qualitySpec: "Moisture at or below 13.5%, aflatoxin-tested, cleaned, packed in 50 kg bags.",
    deliveryLocation: "Kariakoo market, Dar es Salaam",
    deliveryInDays: 14,
    offersCloseInDays: 5,
  },
  {
    id: "a5000000-0000-4000-8000-000000000002",
    productName: "Hass avocado",
    quantity: "800.00",
    unit: "PIECE",
    qualitySpec: "Export grade, 140–180 g per fruit, firm and unbruised.",
    deliveryLocation: "Dar es Salaam port, cold store 3",
    deliveryInDays: 21,
    offersCloseInDays: 7,
  },
];

const companies = [
  {
    id: "b2000000-0000-4000-8000-000000000001",
    companyCode: "LC-DEMO01",
    name: "Kilimanjaro Freight Co.",
    slug: "kilimanjaro-freight-co",
    registrationNumber: "TZ-BR-48211",
    description:
      "Dry and refrigerated cargo between Moshi, Arusha and Dar es Salaam. Same-day pickup for produce leaving Mbalizi.",
    contactPhone: "+255754220110",
    contactEmail: "ops@kilimanjaro-freight.test",
    address: "Plot 14, Sokoine Road",
    city: "Moshi",
    coverImageUrl: "/images/marketplace/logistics-freight.jpg",
    latitude: "-3.3731",
    longitude: "37.3405",
    owner: true,
    branches: [
      { id: "b4000000-0000-4000-8000-000000000001", name: "Moshi depot", branchCode: "MOS-01" },
    ],
  },
  {
    id: "b2000000-0000-4000-8000-000000000002",
    companyCode: "LC-DEMO02",
    name: "Pwani Cold Chain",
    slug: "pwani-cold-chain",
    registrationNumber: "TZ-BR-51903",
    description:
      "Temperature-controlled trucks for fruit, vegetables and dairy across the Dar es Salaam region.",
    contactPhone: "+255754220112",
    contactEmail: "hello@pwani-cold-chain.test",
    address: "Nyerere Road, Vingunguti",
    city: "Dar es Salaam",
    coverImageUrl: "/images/marketplace/logistics-cold-chain.jpg",
    latitude: "-6.8280",
    longitude: "39.2400",
    owner: false,
    branches: [
      {
        id: "b4000000-0000-4000-8000-000000000002",
        name: "Vingunguti cold store",
        branchCode: "DAR-01",
      },
    ],
  },
  {
    id: "b2000000-0000-4000-8000-000000000003",
    companyCode: "LC-DEMO03",
    name: "Lake Zone Couriers",
    slug: "lake-zone-couriers",
    registrationNumber: "TZ-BR-63440",
    description:
      "Last-mile motorbike and van deliveries for sellers around Mwanza and the lake zone.",
    contactPhone: "+255754220114",
    contactEmail: "dispatch@lake-zone-couriers.test",
    address: "Kenyatta Road",
    city: "Mwanza",
    coverImageUrl: "/images/marketplace/logistics-courier.jpg",
    latitude: "-2.5164",
    longitude: "32.9175",
    owner: false,
    branches: [
      { id: "b4000000-0000-4000-8000-000000000003", name: "Mwanza hub", branchCode: "MWZ-01" },
    ],
  },
];

const serviceListings = [
  {
    listingNumber: "SL-DEMO11",
    vendorSlug: "art-crafts-supply-co",
    title: "Pottery wheel class — beginner",
    description:
      "Two hours at the wheel with a studio potter. Clay, tools and firing of one piece included.",
    unitPrice: "45000.00",
    durationMinutes: 120,
    location: "Art & Crafts Supply Studio, Arusha",
    coverImageUrl: "/images/marketplace/services-pottery.jpg",
  },
  {
    listingNumber: "SL-DEMO12",
    vendorSlug: "art-crafts-supply-co",
    title: "Product photography session",
    description: "Studio shoot for up to ten products, with edited images delivered in 48 hours.",
    unitPrice: "120000.00",
    durationMinutes: 120,
    location: "Art & Crafts Supply Studio, Arusha",
    coverImageUrl: "/images/marketplace/services-photography.jpg",
  },
  {
    listingNumber: "SL-DEMO13",
    vendorSlug: "food-beverages-supply-co",
    title: "Coffee cupping session",
    description:
      "Taste four Tanzanian single origins with the roaster and take home 250 g of beans.",
    unitPrice: "35000.00",
    durationMinutes: 60,
    location: "Food & Beverages Supply Roastery, Mbeya",
    coverImageUrl: "/images/marketplace/services-coffee-cupping.jpg",
  },
  {
    listingNumber: "SL-DEMO14",
    vendorSlug: "food-beverages-supply-co",
    title: "Private catering tasting",
    description: "Menu tasting for events of 20 guests or more, priced per head on the day.",
    unitPrice: "150000.00",
    durationMinutes: 90,
    location: "Food & Beverages Supply Kitchen, Dar es Salaam",
    coverImageUrl: "/images/marketplace/services-catering.jpg",
  },
];

const client = new Client({ connectionString });
const passwordHash = await hash(DEMO_PASSWORD);

try {
  await client.connect();
  await client.query("BEGIN");

  const upsertUser = async ({ id, email, name }) => {
    await client.query(
      `INSERT INTO users (id, email, name, password_hash, email_verified_at, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), 'CUSTOMER', 'ACTIVE', now(), now())
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           email_verified_at = now(),
           status = 'ACTIVE',
           updated_at = now()`,
      [id, email, name, passwordHash],
    );
    const { rows } = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    return rows[0].id;
  };

  for (const farmer of farmers) {
    const userId = await upsertUser(farmer.user);

    await client.query(
      `INSERT INTO agriculture_farmers (
         id, user_id, verification_status, phone, region, district, ward, village, note,
         verified_at, created_at, updated_at
       )
       VALUES ($1, $2, 'VERIFIED', $3, $4, $5, $6, $7, $8, now(), now(), now())
       ON CONFLICT (user_id) DO NOTHING`,
      [
        farmer.farmer.id,
        userId,
        farmer.farmer.phone,
        farmer.farmer.region,
        farmer.farmer.district,
        farmer.farmer.ward,
        farmer.farmer.village,
        farmer.farmer.note,
      ],
    );

    await client.query(
      `INSERT INTO farms (
         id, farmer_id, name, size_value, size_unit, ownership,
         region, district, ward, village, water_source, soil_info, is_active, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5::"FarmSizeUnit", 'OWNED', $6, $7, $8, $9, $10, $11, true, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [
        farmer.farm.id,
        farmer.farmer.id,
        farmer.farm.name,
        farmer.farm.sizeValue,
        farmer.farm.sizeUnit,
        farmer.farmer.region,
        farmer.farmer.district,
        farmer.farmer.ward,
        farmer.farmer.village,
        farmer.farm.waterSource,
        farmer.farm.soilInfo,
      ],
    );

    for (const listing of farmer.listings) {
      await client.query(
        `INSERT INTO agricultural_listings (
           id, farmer_id, farm_id, crop_name, variety, quantity, unit, price_per_unit, currency,
           minimum_order, grade, harvest_date, collection_location, cover_image_url,
           delivery_available, organic_claim, certified_claim, status, published_at, created_at, updated_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7::"AgriculturalUnit", $8, 'TZS',
           $9, $10, now() - make_interval(days => $11::int), $12, $13,
           $14, $15, $16, 'PUBLISHED', now(), now(), now()
         )
         ON CONFLICT (id) DO UPDATE SET
           cover_image_url = COALESCE(agricultural_listings.cover_image_url, EXCLUDED.cover_image_url)`,
        [
          listing.id,
          farmer.farmer.id,
          farmer.farm.id,
          listing.cropName,
          listing.variety,
          listing.quantity,
          listing.unit,
          listing.pricePerUnit,
          listing.minimumOrder,
          listing.grade,
          listing.harvestDateDaysAgo,
          listing.collectionLocation,
          listing.coverImageUrl,
          listing.deliveryAvailable,
          listing.organicClaim,
          listing.certifiedClaim,
        ],
      );
    }
  }

  const buyerId = await client
    .query("SELECT id FROM users WHERE email = 'customer@supplyhub.test'")
    .then((result) => result.rows[0]?.id);

  if (!buyerId) {
    throw new Error(
      "The demo buyer customer@supplyhub.test is missing. Run npm run db:seed first.",
    );
  }

  for (const request of buyerRequests) {
    await client.query(
      `INSERT INTO agricultural_buyer_requests (
         id, buyer_user_id, product_name, quantity, unit, quality_spec, delivery_location,
         delivery_deadline, offer_deadline, status, created_at
       )
       VALUES (
         $1, $2, $3, $4, $5::"AgriculturalUnit", $6, $7,
         now() + make_interval(days => $8::int), now() + make_interval(days => $9::int), 'OPEN', now()
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        request.id,
        buyerId,
        request.productName,
        request.quantity,
        request.unit,
        request.qualitySpec,
        request.deliveryLocation,
        request.deliveryInDays,
        request.offersCloseInDays,
      ],
    );
  }

  const logisticsUser = await upsertUser({
    id: "b1000000-0000-4000-8000-000000000001",
    email: "logistics@supplyhub.test",
    name: "Baraka Nyerere",
  });
  const adminId = await client
    .query("SELECT id FROM users WHERE email = 'admin@supplyhub.test'")
    .then((result) => result.rows[0]?.id ?? null);

  const permissionRows = (
    await client.query(
      "SELECT id, permission_key FROM permissions WHERE permission_key LIKE 'logistics.%'",
    )
  ).rows;
  const permissionByKey = new Map(permissionRows.map((row) => [row.permission_key, row.id]));

  const roleBlueprints = [
    {
      id: "b3000000-0000-4000-8000-000000000001",
      name: "owner",
      description: "Full control of the logistics company",
      keys: [...permissionByKey.keys()],
    },
    {
      id: "b3000000-0000-4000-8000-000000000002",
      name: "dispatcher",
      description: "Assigns drivers and manages day-to-day jobs",
      keys: [
        "logistics.company.read",
        "logistics.dispatch.manage",
        "logistics.client.manage",
        "logistics.driver.view",
      ],
    },
    {
      id: "b3000000-0000-4000-8000-000000000003",
      name: "driver",
      description: "Sees and completes own deliveries",
      keys: ["logistics.company.read", "logistics.driver.view"],
    },
  ];

  for (const [index, company] of companies.entries()) {
    const settingsId = `b6000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    await client.query(
      `INSERT INTO logistics_companies (
         id, company_code, name, slug, registration_number, description, contact_phone, contact_email,
         address, city, cover_image_url, country_code, latitude, longitude, status, plan, submitted_at,
         reviewed_by_id, reviewed_at, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, 'TZ', $12, $13, 'APPROVED', 'growth', now() - interval '20 days', $14,
         now() - interval '18 days', now(), now()
       )
       ON CONFLICT (id) DO UPDATE SET
         cover_image_url = COALESCE(logistics_companies.cover_image_url, EXCLUDED.cover_image_url)`,
      [
        company.id,
        company.companyCode,
        company.name,
        company.slug,
        company.registrationNumber,
        company.description,
        company.contactPhone,
        company.contactEmail,
        company.address,
        company.city,
        company.coverImageUrl,
        company.latitude,
        company.longitude,
        adminId,
      ],
    );

    await client.query(
      `INSERT INTO logistics_company_settings (
         id, company_id, currency, timezone, notification_email, default_service_radius, updated_at
       )
       VALUES ($1, $2, 'TZS', 'Africa/Dar_es_Salaam', $3, 25, now())
       ON CONFLICT (company_id) DO NOTHING`,
      [settingsId, company.id, company.contactEmail],
    );

    for (const branch of company.branches) {
      await client.query(
        `INSERT INTO logistics_branches (
           id, company_id, name, branch_code, address, city, latitude, longitude,
           is_primary, is_active, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true, now(), now())
         ON CONFLICT (company_id, branch_code) DO NOTHING`,
        [
          branch.id,
          company.id,
          branch.name,
          branch.branchCode,
          company.address,
          company.city,
          company.latitude,
          company.longitude,
        ],
      );
    }

    if (!company.owner) continue;

    for (const role of roleBlueprints) {
      const roleId = role.id;
      await client.query(
        `INSERT INTO logistics_company_roles (id, company_id, name, is_system, description, created_at, updated_at)
         VALUES ($1, $2, $3, true, $4, now(), now())
         ON CONFLICT (company_id, name) DO NOTHING`,
        [roleId, company.id, role.name, role.description],
      );

      const assigned = await client
        .query("SELECT id FROM logistics_company_roles WHERE company_id = $1 AND name = $2", [
          company.id,
          role.name,
        ])
        .then((result) => result.rows[0].id);

      const permissionIds = role.keys.map((key) => permissionByKey.get(key)).filter(Boolean);
      if (permissionIds.length > 0) {
        await client.query(
          `INSERT INTO logistics_role_permissions (role_id, permission_id)
           SELECT $1, unnest($2::uuid[])
           ON CONFLICT DO NOTHING`,
          [assigned, permissionIds],
        );
      }
    }

    const memberId = "b5000000-0000-4000-8000-000000000001";
    await client.query(
      `INSERT INTO logistics_company_members (
         id, company_id, user_id, status, invited_by_id, joined_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, 'ACTIVE', $3, now() - interval '19 days', now(), now())
       ON CONFLICT (company_id, user_id) DO NOTHING`,
      [memberId, company.id, logisticsUser],
    );

    const ownerRoleId = await client
      .query("SELECT id FROM logistics_company_roles WHERE company_id = $1 AND name = 'owner'", [
        company.id,
      ])
      .then((result) => result.rows[0].id);

    await client.query(
      `INSERT INTO logistics_member_roles (member_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [memberId, ownerRoleId],
    );
  }

  for (const service of serviceListings) {
    const vendor = await client
      .query(
        `SELECT v.id AS vendor_id, v.business_id
         FROM vendors v
         JOIN businesses b ON b.id = v.business_id
         WHERE b.slug = $1
         LIMIT 1`,
        [service.vendorSlug],
      )
      .then((result) => result.rows[0]);

    if (!vendor) {
      throw new Error(
        `Vendor for business slug ${service.vendorSlug} is missing. Run npm run db:seed first.`,
      );
    }

    await client.query(
      `INSERT INTO service_listings (
         id, listing_number, vendor_id, business_id, title, description, currency, unit_price,
         duration_minutes, location, cover_image_url, status, published_at, created_at, updated_at
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'TZS', $6, $7, $8, $9, 'ACTIVE', now(), now(), now())
       ON CONFLICT (listing_number) DO UPDATE SET
         cover_image_url = COALESCE(service_listings.cover_image_url, EXCLUDED.cover_image_url)`,
      [
        service.listingNumber,
        vendor.vendor_id,
        vendor.business_id,
        service.title,
        service.description,
        service.unitPrice,
        service.durationMinutes,
        service.location,
        service.coverImageUrl,
      ],
    );
  }

  await client.query("COMMIT");

  const summary = await client.query(`
    SELECT
      (SELECT count(*) FROM agricultural_listings WHERE status = 'PUBLISHED') AS listings,
      (SELECT count(*) FROM agricultural_buyer_requests WHERE status = 'OPEN') AS requests,
      (SELECT count(*) FROM logistics_companies WHERE status = 'APPROVED') AS companies,
      (SELECT count(*) FROM service_listings WHERE status = 'ACTIVE') AS services
  `);

  console.log("Marketplace demo data ready:", summary.rows[0]);
  console.log(`Farmer sign-in:    farmer@supplyhub.test / ${DEMO_PASSWORD}`);
  console.log(`Logistics sign-in: logistics@supplyhub.test / ${DEMO_PASSWORD}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
