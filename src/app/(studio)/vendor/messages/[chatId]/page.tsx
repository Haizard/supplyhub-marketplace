import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatInbox } from "@/features/messaging/components/chat-inbox";
import { getConversation, listConversations } from "@/features/messaging/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

interface Props {
  params: Promise<{ chatId: string }>;
}

export const metadata: Metadata = {
  title: "Buyer conversation",
  robots: { index: false, follow: false },
};

export default function StudioMessageThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-[32rem]" />}>
      <StudioMessageThreadContent params={params} />
    </Suspense>
  );
}

async function StudioMessageThreadContent({ params }: Props) {
  const [{ chatId }, access, { t }] = await Promise.all([
    params,
    requireStudioAccess("messaging.reply", "/vendor/messages"),
    getServerI18n(),
  ]);
  const scope = {
    side: "studio" as const,
    viewerId: access.actor.id,
    vendorId: access.vendorId,
  };
  const [conversation, conversations] = await Promise.all([
    getConversation(scope, chatId),
    listConversations(scope),
  ]);

  if (!conversation) notFound();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("messaging.studioTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("messaging.studioSubtitle")}</p>
      </header>
      <ChatInbox conversations={conversations} side="studio" initialChatId={chatId} />
    </PageShell>
  );
}
