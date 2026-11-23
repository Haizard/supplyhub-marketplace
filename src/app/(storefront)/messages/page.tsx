import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatInbox } from "@/features/messaging/components/chat-inbox";
import { listConversations } from "@/features/messaging/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Messages",
  description: "Your direct conversations with SupplyHub studios.",
  robots: { index: false, follow: false },
};

export default function MessagesPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-10 h-[32rem] max-w-[1100px]" />}>
      <MessagesContent />
    </Suspense>
  );
}

async function MessagesContent() {
  const [actor, { t }] = await Promise.all([requireActor("/messages"), getServerI18n()]);
  const conversations = await listConversations({ side: "buyer", viewerId: actor.id });

  return (
    <PageShell className="py-10 sm:py-14">
      <header className="mb-6 border-b border-border pb-6">
        <p className="eyebrow text-muted-foreground">{t("messaging.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          {t("messaging.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("messaging.subtitle")}</p>
      </header>
      <ChatInbox conversations={conversations} side="buyer" />
    </PageShell>
  );
}
