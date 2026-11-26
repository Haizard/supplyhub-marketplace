-- Operator approval (2026-11-26): enable the installment sales and financing
-- record-keeping workflows on existing deployments. The financing workflow still
-- makes no partner call, credit decision, payout or money movement.

UPDATE "feature_flags"
SET "enabled" = true, "updated_at" = now()
WHERE "key" IN ('phase10.installmentSales', 'phase10.installmentFinancing');
