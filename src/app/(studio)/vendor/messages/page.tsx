import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatInbox } from "@/features/messaging/components/chat-inbox";
import { listConversations } from "@/features/messaging/queries";
import { getServerI18n } from "@/i18n/server";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Buyer messages",
  robots: { index: false, follow: false },
};

export default function StudioMessagesPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-[32rem]" />}>
      <StudioMessagesContent />
    </Suspense>
  );
}

async function StudioMessagesContent() {
  const access = await requireStudioAccess("messaging.reply", "/vendor/messages");
  const { t } = await getServerI18n();
  const conversations = await listConversations({
    side: "studio",
    viewerId: access.actor.id,
    vendorId: access.vendorId,
  });

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">{t("messaging.studioTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("messaging.studioSubtitle")}</p>
      </header>
      <ChatInbox conversations={conversations} side="studio" className="border-border bg-surface" />
    </PageShell>
  );
}
