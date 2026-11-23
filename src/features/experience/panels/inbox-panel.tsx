"use client";

import Link from "next/link";
import { Inbox, MessageSquare } from "lucide-react";

import { ChatInbox } from "@/features/messaging/components/chat-inbox";
import type { ChatConversationView } from "@/features/messaging/types";
import { useT } from "@/i18n/client";

export function InboxPanel({
  viewerId,
  conversations,
}: {
  viewerId: string | null;
  conversations: ChatConversationView[];
}) {
  const t = useT();

  if (!viewerId) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <MessageSquare className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-medium">
          {t("experience.inbox.signInTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("experience.inbox.signInBody")}
        </p>
        <Link
          href="/sign-in?next=%2Fexperience%3Ftab%3Dinbox"
          className="mt-4 inline-flex rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90"
        >
          {t("experience.inbox.signIn")}
        </Link>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-medium">{t("messaging.emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("experience.inbox.body")}
        </p>
        <Link
          href="/products"
          className="mt-4 inline-flex rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90"
        >
          {t("messaging.browse")}
        </Link>
      </div>
    );
  }

  return <ChatInbox conversations={conversations} side="buyer" compact />;
}
