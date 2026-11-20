# Database Audit

> Phase 0 audit — updated for HEAD 4a923d4. Schema unchanged from initial commit.

## Summary

- **20 tables**, same as initial audit. No new migrations in any of the recent commits.
- All new features added since the zip (delivery tracking, experience centre, trust hub, i18n, search autocomplete, mobile nav) are **implemented client-side** with no database schema changes.
- This means the database gap identified in the first audit is fully confirmed: the schema supports the marketplace core but nothing yet for Business OS, logistics, B2B, subscriptions, or trust.

## Critical Observation: Prototype Features Have No Database Backing

Several features that now exist in the UI have **zero database backing**:

| Feature | Current Storage | Risk |
|---|---|---|
| Delivery agent tracking | Client localStorage + BroadcastChannel | Lost on clear; not shared with server |
| Wishlists | Client localStorage | Not persisted to account |
| Price watch | Client localStorage | Not persisted to account |
| Buyer↔studio chat | Client localStorage | Not real messages |
| Sandbox orders | Client localStorage | Not real orders |
| Security (2FA, phone) | Client localStorage | Not real security |
| Buyer protection features | UI only | No enforcement |
| Product reviews | Client localStorage | Not persisted |

These are **demo/prototype features**. Before any of these are presented to real users as working, they need database tables and server actions.

## Tables Review (unchanged from initial audit — key points restated)

### Schema strengths confirmed
- UUID PKs throughout ✅
- `Timestamptz(6)` on all timestamps ✅
- `Decimal(12,2)` for all money ✅
- `commission_ledger` and `inventory_movements` are insert-only ✅
- Order item snapshots (price, name) cannot be overwritten ✅
- Idempotency enforced at DB level for payments ✅

### Gaps confirmed unchanged

| Domain | Missing Tables |
|---|---|
| Business OS | `businesses`, `business_members`, `business_branches`, `business_roles`, `permissions`, `role_permissions`, `member_roles`, `business_documents`, `business_settings` |
| POS | `pos_registers`, `pos_sessions`, `sales`, `sale_items`, `sale_payments` |
| Extended Inventory | `warehouses`, `inventory_balances`, `stock_reservations`, `stock_transfers` |
| Finance | `expenses`, `financial_accounts`, `journal_entries`, `journal_lines` |
| CRM | `customers` (vendor-scoped), `customer_notes`, `loyalty_accounts`, `loyalty_transactions` |
| Suppliers | `suppliers`, `supplier_invoices`, `purchase_orders`, `purchase_order_items`, `goods_receipts` |
| Logistics (real) | `delivery_agents`, `delivery_vehicles`, `delivery_requests`, `delivery_jobs`, `delivery_assignments`, `delivery_status_history`, `delivery_locations`, `delivery_proofs`, `agent_earnings` |
| Trust (real) | `wishlists`, `product_reviews`, `business_reviews`, `returns`, `return_items`, `chats`, `chat_messages` |
| Subscriptions | `subscription_plans`, `business_subscriptions`, `subscription_invoices` |
| B2B | `wholesale_listings`, `rfqs`, `supplier_quotations`, `business_purchase_orders` |
| Notifications | `notification_templates`, `notification_jobs`, `notification_deliveries` |
| Platform | `outbox_events`, `feature_flags`, `idempotency_keys` |

## New Gap: Prototype-to-Production Conversion Required

The experience centre and delivery tracking introduce **data models in TypeScript** (in `src/features/experience/types.ts` and `src/components/delivery/model.ts`) that are well-designed and can be used as direct specifications for database tables when converting these features from prototype to production.

For example, `SandboxOrder` in `experience/types.ts` maps closely to what will become the proper `orders` extension with escrow fields. `Delivery` in `delivery/model.ts` maps closely to the `delivery_jobs` table needed in Phase 4.

These TypeScript types should be treated as schema drafts, not discarded.
