import { describe, expect, it } from "vitest";

import {
  canOpenConversation,
  countUnread,
  sortConversations,
  type ChatConversationView,
} from "@/features/messaging/types";

function conversation(overrides: Partial<ChatConversationView> = {}): ChatConversationView {
  return {
    id: "chat-1",
    buyerId: "buyer-1",
    buyerName: "Mara",
    vendorId: "vendor-1",
    vendorName: "Atelier Nord",
    vendorSlug: "atelier-nord",
    productId: null,
    productName: null,
    productSlug: null,
    lastMessageAt: "2026-11-21T09:00:00.000Z",
    unread: 0,
    messages: [],
    ...overrides,
  };
}

describe("messaging helpers", () => {
  it("counts only unread messages sent by the other party", () => {
    expect(
      countUnread(
        [
          { senderId: "buyer-1", readAt: new Date() },
          { senderId: "studio-1", readAt: null },
          { senderId: "studio-1", readAt: "2026-11-21T09:00:00.000Z" },
          { senderId: "buyer-1", readAt: null },
        ],
        "buyer-1",
      ),
    ).toBe(1);
  });

  it("sorts conversations by recent activity with a stable tie-breaker", () => {
    const chats = [
      conversation({ id: "a", lastMessageAt: "2026-11-21T08:00:00.000Z" }),
      conversation({ id: "z", lastMessageAt: "2026-11-21T10:00:00.000Z" }),
      conversation({ id: "b", lastMessageAt: "2026-11-21T09:00:00.000Z" }),
      conversation({ id: "a2", lastMessageAt: "2026-11-21T09:00:00.000Z" }),
    ];

    expect(sortConversations(chats).map((chat) => chat.id)).toEqual(["z", "a2", "b", "a"]);
  });

  it("only opens a thread for its buyer or the matching studio", () => {
    const chat = conversation();

    expect(canOpenConversation(chat, { side: "buyer", viewerId: "buyer-1" })).toBe(true);
    expect(canOpenConversation(chat, { side: "buyer", viewerId: "buyer-2" })).toBe(false);
    expect(
      canOpenConversation(chat, {
        side: "studio",
        viewerId: "staff-1",
        vendorId: "vendor-1",
      }),
    ).toBe(true);
    expect(
      canOpenConversation(chat, {
        side: "studio",
        viewerId: "staff-1",
        vendorId: "vendor-2",
      }),
    ).toBe(false);
    expect(canOpenConversation(chat, { side: "studio", viewerId: "staff-1" })).toBe(false);
  });
});
