import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/db/client";

import { countUnread, sortConversations, type ChatConversationView, type ChatScope } from "./types";

const MESSAGE_LIMIT = 120;

const chatInclude = {
  buyer: { select: { id: true, name: true } },
  vendor: { select: { id: true, name: true, slug: true } },
  product: { select: { name: true, slug: true } },
  messages: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MESSAGE_LIMIT,
    select: {
      id: true,
      senderId: true,
      body: true,
      readAt: true,
      createdAt: true,
      sender: { select: { name: true } },
    },
  },
} as const satisfies Prisma.ChatInclude;

type LoadedChat = Prisma.ChatGetPayload<{ include: typeof chatInclude }>;

function toConversation(chat: LoadedChat, viewerId: string): ChatConversationView {
  return {
    id: chat.id,
    buyerId: chat.buyer.id,
    buyerName: chat.buyer.name,
    vendorId: chat.vendor.id,
    vendorName: chat.vendor.name,
    vendorSlug: chat.vendor.slug,
    productId: chat.productId,
    productName: chat.product?.name ?? null,
    productSlug: chat.product?.slug ?? null,
    lastMessageAt: chat.lastMessageAt.toISOString(),
    unread: countUnread(chat.messages, viewerId),
    messages: chat.messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      mine: message.senderId === viewerId,
    })),
  };
}

function scopeWhere(scope: ChatScope): Prisma.ChatWhereInput {
  if (scope.side === "buyer") return { buyerId: scope.viewerId };
  if (!scope.vendorId) throw new Error("A studio chat scope needs a vendor id.");
  return { vendorId: scope.vendorId };
}

/** Buyer inbox or studio inbox, newest conversation first. */
export async function listConversations(
  scope: ChatScope,
  limit = 50,
): Promise<ChatConversationView[]> {
  const chats = await getDatabase().chat.findMany({
    where: scopeWhere(scope),
    include: chatInclude,
    orderBy: { lastMessageAt: "desc" },
    take: limit,
  });

  return sortConversations(chats.map((chat) => toConversation(chat, scope.viewerId)));
}

/** One conversation, only when this viewer is a participant. */
export async function getConversation(
  scope: ChatScope,
  chatId: string,
): Promise<ChatConversationView | null> {
  const chat = await getDatabase().chat.findFirst({
    where: { id: chatId, ...scopeWhere(scope) },
    include: chatInclude,
  });

  return chat ? toConversation(chat, scope.viewerId) : null;
}
