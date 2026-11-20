-- Audit action for tracking details captured at handover.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SHIPMENT_RECORDED';
