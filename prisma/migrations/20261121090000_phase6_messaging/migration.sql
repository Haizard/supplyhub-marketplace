-- Phase 6: real buyer ↔ studio messaging.
-- Replaces the localStorage-only inbox with account-backed threads and messages.

ALTER TYPE "AuditAction" ADD VALUE 'CHAT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CHAT_MESSAGE_SENT';

CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "product_id" UUID,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chats_buyer_id_vendor_id_key" ON "chats"("buyer_id", "vendor_id");
CREATE INDEX "chats_buyer_id_last_message_at_idx" ON "chats"("buyer_id", "last_message_at");
CREATE INDEX "chats_vendor_id_last_message_at_idx" ON "chats"("vendor_id", "last_message_at");
CREATE INDEX "chat_messages_chat_id_created_at_idx" ON "chat_messages"("chat_id", "created_at");

ALTER TABLE "chats" ADD CONSTRAINT "chats_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chats" ADD CONSTRAINT "chats_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chats" ADD CONSTRAINT "chats_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Studio staff need an explicit permission to reply; owners receive it through
-- the system owner roles below and legacy studios keep their full-access shortcut.
INSERT INTO "permissions" ("id", "permission_key", "description")
VALUES (gen_random_uuid(), 'messaging.reply', 'Reply to buyer conversations')
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "business_roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND p."permission_key" = 'messaging.reply'
ON CONFLICT DO NOTHING;
