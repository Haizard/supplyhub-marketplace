"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";

import { startVendorChatAction } from "@/features/messaging/actions";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

export function StudioChatButton({
  vendorSlug,
  vendorName,
  productId,
  className,
}: {
  vendorSlug: string;
  vendorName: string;
  productId?: string;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function openChat() {
    setPending(true);
    setError("");
    try {
      const result = await startVendorChatAction(vendorSlug, productId);
      if (result.ok) {
        router.push(`/messages/${result.chatId}`);
        return;
      }
      setError(result.error || t("messaging.error"));
    } catch {
      setError(t("messaging.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={() => void openChat()}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-[#0f766e]/50 hover:text-[#0f766e] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      >
        <MessageSquare className="size-4" aria-hidden="true" />
        {pending ? t("messaging.opening") : t("product.messageStudio")}
      </button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
      <span className="sr-only">{vendorName}</span>
    </div>
  );
}
