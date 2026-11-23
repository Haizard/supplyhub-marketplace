# Migration Strategy

> Phase 0 audit — updated for HEAD 4a923d4. No new migrations were added in recent commits.

## Principles (unchanged)

1. Never alter existing column types or drop columns.
2. Never drop existing tables.
3. Immutable tables stay immutable: `inventory_movements`, `commission_ledger`, `order_items`, `audit_logs`.
4. Financial records use reversals, not corrections.
5. Link new entities to existing ones via FKs.
6. One migration per concern.
7. All migrations must be reversible or explicitly documented.

## New Consideration: Prototype TypeScript Models as Schema Drafts

The recent commits added two files with well-defined TypeScript interfaces that map directly to needed database tables:

- `src/components/delivery/model.ts` → `delivery_jobs`, `delivery_agents`, `delivery_locations`
- `src/features/experience/types.ts` → `wishlists`, `chats`, `chat_messages`, `product_reviews`, `returns`

When creating migrations for Phases 3 and 4, use these TypeScript types as the column specification. Do not redesign from scratch.

## Phase 1 — Business Identity

```sql
-- New tables
businesses, business_members, business_branches, business_roles,
permissions, role_permissions, member_roles, business_documents, business_settings

-- Alteration to existing table
ALTER TABLE vendors ADD COLUMN business_id UUID REFERENCES businesses(id);
-- (nullable; backfill via script after schema migration)
```

## Phase 2 — Business OS

```sql
-- New tables
warehouses, inventory_balances, pos_registers, pos_sessions,
sales, sale_items, sale_payments, expenses

-- Alteration
ALTER TABLE inventory_movements ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
-- (nullable; existing rows get NULL = "default warehouse")
```

## Phase 3 — Commerce Integration + Prototype Conversion

```sql
-- New tables
product_variants, order_status_history, returns, return_items,
promotions, coupons, coupon_redemptions,
wishlists,          -- replaces localStorage
product_reviews,    -- replaces localStorage
business_reviews,
shipments, shipment_items

-- Alteration
ALTER TABLE order_items ADD COLUMN variant_id UUID REFERENCES product_variants(id);
-- (nullable; existing items retain NULL)
```

## Phase 4 — Logistics Network

```sql
-- New tables (derived from delivery/model.ts TypeScript types)
delivery_agents, delivery_vehicles, agent_documents,
agent_service_areas, agent_availability,
delivery_requests, delivery_jobs, delivery_job_items,
delivery_assignments, delivery_status_history,
delivery_locations, delivery_pricing_rules, delivery_quotes,
delivery_proofs, delivery_batches, delivery_batch_stops,
agent_earnings, delivery_commissions

-- Alteration
ALTER TABLE orders ADD COLUMN delivery_job_id UUID REFERENCES delivery_jobs(id);
-- (nullable; existing orders have no delivery job)
```

## Phase 5 — B2B

```sql
-- New tables
wholesale_listings, wholesale_price_tiers,
rfqs, rfq_items, supplier_quotations, quotation_items,
business_purchase_orders, business_purchase_order_items,
business_invoices, business_invoice_items
```

## Phase 6 — Subscriptions + Trust Conversion

```sql
-- New tables
subscription_plans, business_subscriptions, subscription_invoices,
chats, chat_messages,       -- replaces experience centre simulation
customers, loyalty_accounts, loyalty_transactions,
agent_payouts,
financial_accounts, journal_entries, journal_lines,
reconciliation_records
```

## Phase 7 — Platform Infrastructure

```sql
-- New tables
outbox_events, notification_templates, notification_jobs,
notification_deliveries, user_notification_preferences,
webhook_endpoints, webhook_deliveries,
idempotency_keys, feature_flags,
business_ai_insights, ai_recommendation_history, ai_usage_records
```

## Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name

Examples:
20261201100000_phase1_business_identity
20261201110000_phase1_business_branches
20261215100000_phase2_warehouses_and_inventory_balances
20261215110000_phase2_pos_tables
20270101100000_phase3_product_variants
20270101110000_phase3_wishlists_and_reviews
```
