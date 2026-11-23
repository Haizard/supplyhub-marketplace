export type ChatSide = "buyer" | "studio";

export interface ChatMessageView {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface ChatConversationView {
  id: string;
  buyerId: string;
  buyerName: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  lastMessageAt: string;
  unread: number;
  messages: ChatMessageView[];
}

export interface ChatScope {
  side: ChatSide;
  viewerId: string;
  vendorId?: string;
}

/** Messages still waiting for this viewer, never the viewer's own sends. */
export function countUnread(
  messages: readonly { senderId: string; readAt: Date | string | null }[],
  viewerId: string,
): number {
  return messages.filter((message) => message.senderId !== viewerId && message.readAt === null)
    .length;
}

/** Most recently active conversation first, with a stable id tie-breaker. */
export function sortConversations(
  conversations: readonly ChatConversationView[],
): ChatConversationView[] {
  return [...conversations].sort((a, b) => {
    const byActivity = b.lastMessageAt.localeCompare(a.lastMessageAt);
    return byActivity || a.id.localeCompare(b.id);
  });
}

/** Keeps a conversation id valid for the chosen inbox before a mutation. */
export function canOpenConversation(
  conversation: Pick<ChatConversationView, "buyerId" | "vendorId">,
  scope: ChatScope,
): boolean {
  if (scope.side === "buyer") return conversation.buyerId === scope.viewerId;
  return conversation.vendorId === scope.vendorId && Boolean(scope.vendorId);
}
