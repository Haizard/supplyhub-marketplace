"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/lib/logging/logger";

import { chatMessageSchema, markReadSchema, startChatSchema } from "./validation";
import type { ChatMessageView, ChatScope } from "./types";

export type StartChatResult = { ok: true; chatId: string } | { ok: false; error: string };
export type SendMessageResult =
  { ok: true; message: ChatMessageView } | { ok: false; error: string };
export type MarkReadResult = { ok: true } | { ok: false; error: string };

function parsedError(): { ok: false; error: string } {
  return { ok: false, error: "That message could not be sent." };
}

function revalidate(scope: ChatScope, chatId: string) {
  if (scope.side === "buyer") {
    revalidatePath("/messages");
    revalidatePath(`/messages/${chatId}`);
    revalidatePath("/experience");
    return;
  }
  revalidatePath("/vendor/messages");
  revalidatePath(`/vendor/messages/${chatId}`);
}

/** Opens or reuses the account-backed thread for a buyer and a studio. */
export async function startVendorChatAction(
  vendorSlug: string,
  productId?: string,
): Promise<StartChatResult> {
  const actor = await requireActor("/messages");
  const parsed = startChatSchema.safeParse({ vendorSlug, productId });
  if (!parsed.success) return { ok: false, error: "That studio could not be found." };

  const database = getDatabase();
  const vendor = await database.vendor.findFirst({
    where: { slug: parsed.data.vendorSlug, status: "APPROVED" },
    select: { id: true, name: true, ownerId: true },
  });

  if (!vendor) return { ok: false, error: "That studio is not accepting messages." };

  if (parsed.data.productId) {
    const product = await database.product.findFirst({
      where: {
        id: parsed.data.productId,
        vendorId: vendor.id,
        status: "PUBLISHED",
      },
      select: { id: true },
    });
    if (!product) return { ok: false, error: "That object is no longer available." };
  }

  let chatId = "";

  try {
    await database.$transaction(async (transaction) => {
      const existing = await transaction.chat.findUnique({
        where: {
          buyerId_vendorId: { buyerId: actor.id, vendorId: vendor.id },
        },
        select: { id: true, productId: true },
      });

      if (existing) {
        chatId = existing.id;
        if (parsed.data.productId && !existing.productId) {
          await transaction.chat.update({
            where: { id: existing.id },
            data: { productId: parsed.data.productId },
          });
        }
        return;
      }

      const chat = await transaction.chat.create({
        data: {
          buyerId: actor.id,
          vendorId: vendor.id,
          productId: parsed.data.productId ?? null,
        },
        select: { id: true },
      });
      chatId = chat.id;

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "CHAT_CREATED",
        targetType: "chat",
        targetId: chat.id,
        metadata: { vendorId: vendor.id, vendorName: vendor.name },
      });
    });
  } catch (error) {
    logger.error("messaging.start_failed", { actorId: actor.id, vendorId: vendor.id, error });
    return { ok: false, error: "The conversation could not be opened." };
  }

  revalidatePath("/messages");
  revalidatePath("/experience");
  return { ok: true, chatId };
}

async function sendMessage(
  scope: ChatScope,
  senderName: string,
  chatId: string,
  body: string,
): Promise<SendMessageResult> {
  const parsed = chatMessageSchema.safeParse({ chatId, body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Write a message." };
  }

  const database = getDatabase();
  const chat = await database.chat.findFirst({
    where: {
      id: parsed.data.chatId,
      ...(scope.side === "buyer" ? { buyerId: scope.viewerId } : { vendorId: scope.vendorId }),
    },
    select: { id: true },
  });

  if (!chat) return { ok: false, error: "That conversation could not be found." };

  const now = new Date();
  let messageId = "";

  try {
    await database.$transaction(async (transaction) => {
      const message = await transaction.chatMessage.create({
        data: {
          chatId: chat.id,
          senderId: scope.viewerId,
          body: parsed.data.body,
        },
        select: { id: true, createdAt: true },
      });
      messageId = message.id;

      await transaction.chat.update({
        where: { id: chat.id },
        data: { lastMessageAt: now },
      });

      await recordAuditEvent(transaction, {
        actorId: scope.viewerId,
        action: "CHAT_MESSAGE_SENT",
        targetType: "chat_message",
        targetId: message.id,
        metadata: { chatId: chat.id, side: scope.side },
      });
    });
  } catch (error) {
    logger.error("messaging.send_failed", { actorId: scope.viewerId, chatId: chat.id, error });
    return parsedError();
  }

  revalidate(scope, chat.id);

  return {
    ok: true,
    message: {
      id: messageId,
      senderId: scope.viewerId,
      senderName,
      body: parsed.data.body,
      createdAt: now.toISOString(),
      mine: true,
    },
  };
}

export async function sendBuyerMessageAction(
  chatId: string,
  body: string,
): Promise<SendMessageResult> {
  const actor = await requireActor("/messages");
  return sendMessage({ side: "buyer", viewerId: actor.id }, actor.name, chatId, body);
}

export async function sendStudioMessageAction(
  chatId: string,
  body: string,
): Promise<SendMessageResult> {
  const access = await requireStudioAccess("messaging.reply", "/vendor/messages");
  return sendMessage(
    { side: "studio", viewerId: access.actor.id, vendorId: access.vendorId },
    access.actor.name,
    chatId,
    body,
  );
}

async function markRead(scope: ChatScope, chatId: string): Promise<MarkReadResult> {
  const parsed = markReadSchema.safeParse({ chatId });
  if (!parsed.success) return { ok: false, error: "That conversation could not be found." };

  const chat = await getDatabase().chat.findFirst({
    where: {
      id: parsed.data.chatId,
      ...(scope.side === "buyer" ? { buyerId: scope.viewerId } : { vendorId: scope.vendorId }),
    },
    select: { id: true },
  });

  if (!chat) return { ok: false, error: "That conversation could not be found." };

  await getDatabase().chatMessage.updateMany({
    where: {
      chatId: chat.id,
      readAt: null,
      senderId: { not: scope.viewerId },
    },
    data: { readAt: new Date() },
  });

  revalidate(scope, chat.id);
  return { ok: true };
}

export async function markBuyerChatReadAction(chatId: string): Promise<MarkReadResult> {
  const actor = await requireActor("/messages");
  return markRead({ side: "buyer", viewerId: actor.id }, chatId);
}

export async function markStudioChatReadAction(chatId: string): Promise<MarkReadResult> {
  const access = await requireStudioAccess("messaging.reply", "/vendor/messages");
  return markRead({ side: "studio", viewerId: access.actor.id, vendorId: access.vendorId }, chatId);
}
