import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DispatchOutboxButton } from "@/features/outbox/components/dispatch-button";
import { listOutboxEvents } from "@/features/outbox/service";
import { getServerI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Outbox events",
  robots: { index: false, follow: false },
};

export default function AdminOutboxPage() {
  return (
    <Suspense fallback={<OutboxSkeleton />}>
      <OutboxContent />
    </Suspense>
  );
}

async function OutboxContent() {
  const [admin, events, { t }] = await Promise.all([
    requireAdmin(),
    listOutboxEvents(50),
    getServerI18n(),
  ]);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">Administration</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em]">
          Transactional outbox
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Domain events are stored with the write that produced them. Dispatch publishes pending
          events to registered handlers with bounded retries.
        </p>
        <p className="mt-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
          {t("admin.signedInAs", { name: admin.name })}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-medium">Recent events</h2>
        <DispatchOutboxButton />
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No outbox events yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{event.eventType}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.aggregateType}
                  {event.aggregateId ? ` · ${event.aggregateId}` : ""} · {event.attempts} attempt(s)
                </p>
                {event.lastError ? (
                  <p className="mt-1 text-xs text-danger">{event.lastError}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  tone={
                    event.status === "PUBLISHED"
                      ? "success"
                      : event.status === "FAILED"
                        ? "danger"
                        : event.status === "PROCESSING"
                          ? "accent"
                          : "neutral"
                  }
                >
                  {event.status}
                </Badge>
                <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function OutboxSkeleton() {
  return (
    <PageShell className="space-y-6 py-10" role="status" aria-label="Loading outbox events">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-64 w-full" />
    </PageShell>
  );
}
