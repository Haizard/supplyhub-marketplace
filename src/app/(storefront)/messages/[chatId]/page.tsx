import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatInbox } from "@/features/messaging/components/chat-inbox";
import { getConversation, listConversations } from "@/features/messaging/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

interface Props {
  params: Promise<{ chatId: string }>;
}

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

export default function MessageThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-10 h-[32rem] max-w-[1100px]" />}>
      <MessageThreadContent params={params} />
    </Suspense>
  );
}

async function MessageThreadContent({ params }: Props) {
  const [{ chatId }, actor, { t }] = await Promise.all([
    params,
    requireActor("/messages"),
    getServerI18n(),
  ]);
  const scope = { side: "buyer" as const, viewerId: actor.id };
  const [conversation, conversations] = await Promise.all([
    getConversation(scope, chatId),
    listConversations(scope),
  ]);

  if (!conversation) notFound();

  return (
    <PageShell className="py-10 sm:py-14">
      <header className="mb-6 border-b border-border pb-6">
        <p className="eyebrow text-muted-foreground">{t("messaging.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          {t("messaging.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("messaging.subtitle")}</p>
      </header>
      <ChatInbox conversations={conversations} side="buyer" initialChatId={chatId} />
    </PageShell>
  );
}
