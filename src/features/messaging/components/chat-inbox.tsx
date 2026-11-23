"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Inbox, Send, ShieldCheck } from "lucide-react";

import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

import {
  markBuyerChatReadAction,
  markStudioChatReadAction,
  sendBuyerMessageAction,
  sendStudioMessageAction,
} from "../actions";
import type { ChatConversationView, ChatMessageView, ChatSide } from "../types";

const messageTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatInbox({
  conversations,
  side,
  initialChatId,
  compact = false,
  className,
}: {
  conversations: ChatConversationView[];
  side: ChatSide;
  initialChatId?: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [activeId, setActiveId] = useState(() => {
    if (initialChatId && conversations.some((chat) => chat.id === initialChatId)) {
      return initialChatId;
    }
    return conversations[0]?.id ?? "";
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, ChatMessageView[]>>({});
  const readRef = useRef("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const active = conversations.find((chat) => chat.id === activeId) ?? null;
  const messages = active ? [...active.messages, ...(optimistic[active.id] ?? [])] : [];

  useEffect(() => {
    if (!active || active.unread === 0) return;
    const key = `${active.id}:${active.unread}`;
    if (readRef.current === key) return;
    readRef.current = key;

    const markRead = side === "buyer" ? markBuyerChatReadAction : markStudioChatReadAction;
    void markRead(active.id).then((result) => {
      if (result.ok) router.refresh();
    });
  }, [active, router, side]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, activeId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!active || !body || pending) return;

    setPending(true);
    setError("");
    const send = side === "buyer" ? sendBuyerMessageAction : sendStudioMessageAction;

    void send(active.id, body)
      .then((result) => {
        if (!result.ok) {
          setError(result.error || t("messaging.error"));
          return;
        }
        setOptimistic((prev) => ({
          ...prev,
          [active.id]: [...(prev[active.id] ?? []), result.message],
        }));
        setDraft("");
        router.refresh();
      })
      .catch(() => setError(t("messaging.error")))
      .finally(() => setPending(false));
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-medium">{t("messaging.emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("messaging.emptyBody")}
        </p>
        <Link
          href={side === "buyer" ? "/products" : "/vendor"}
          className="mt-4 inline-flex rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90"
        >
          {side === "buyer" ? t("messaging.browse") : t("studio.overview")}
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface",
        "grid sm:grid-cols-[0.36fr_0.64fr]",
        className,
      )}
    >
      <ul
        className={cn(
          "divide-y divide-border overflow-y-auto border-b border-border sm:border-r sm:border-b-0",
          compact ? "max-h-[26rem]" : "max-h-[34rem]",
        )}
        aria-label={side === "buyer" ? t("messaging.studios") : t("messaging.buyers")}
      >
        {conversations.map((chat) => (
          <li key={chat.id}>
            <button
              type="button"
              onClick={() => {
                setActiveId(chat.id);
                setError("");
              }}
              aria-current={activeId === chat.id ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-surface-muted",
                activeId === chat.id && "bg-surface-muted",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0f766e]/10 text-xs font-bold text-[#0f766e]">
                {(side === "buyer" ? chat.vendorName : chat.buyerName).slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {side === "buyer" ? chat.vendorName : chat.buyerName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {chat.messages.at(-1)?.body ??
                    optimistic[chat.id]?.at(-1)?.body ??
                    t("messaging.sayHello")}
                </span>
              </span>
              {chat.unread > 0 ? (
                <span className="grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-white">
                  {chat.unread}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div className={cn("flex flex-col", compact ? "min-h-[26rem]" : "min-h-[34rem]")}>
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {side === "buyer" ? active.vendorName : active.buyerName}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-[#0f766e]" aria-hidden="true" />
                  {t("messaging.onPlatform")}
                </p>
              </div>
              {active.productSlug && active.productName ? (
                <Link
                  href={`/products/${active.productSlug}`}
                  className="max-w-[45%] truncate rounded-full border border-border px-2.5 py-1 text-[0.6875rem] text-muted-foreground transition hover:text-foreground"
                >
                  {t("messaging.aboutProduct", { name: active.productName })}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex-1 scrollbar-thin space-y-2 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3 py-2 text-sm",
                    message.mine
                      ? "rounded-br-sm bg-[#0f766e] text-white"
                      : "rounded-bl-sm bg-surface-muted text-foreground",
                  )}
                >
                  <p className="break-words whitespace-pre-wrap">{message.body}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[0.625rem]",
                      message.mine ? "text-white/70" : "text-muted-foreground",
                    )}
                  >
                    {messageTime(message.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("messaging.placeholder")}
              aria-label={t("messaging.placeholder")}
              maxLength={2000}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-[#0f766e] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || pending}
              aria-label={t("messaging.send")}
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#0f766e] text-white transition hover:bg-[#0f766e]/90 disabled:opacity-40"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </form>
          {error ? <p className="text-destructive px-3 pb-3 text-xs">{error}</p> : null}
        </div>
      ) : (
        <div className="grid min-h-[26rem] place-items-center p-8 text-center text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <ArrowLeft className="size-4" aria-hidden="true" /> {t("messaging.select")}
          </span>
        </div>
      )}
    </div>
  );
}
