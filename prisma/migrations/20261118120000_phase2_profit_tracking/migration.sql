-- Phase 2: profit tracking.
-- Additive only. Costs are optional so existing objects keep working; a sale line
-- snapshots the unit cost at the moment of sale so later cost edits never rewrite
-- past profit.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "cost_price" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN "unit_cost" DECIMAL(12,2);
