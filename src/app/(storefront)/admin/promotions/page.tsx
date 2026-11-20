import type { Metadata } from "next";
import { Percent } from "lucide-react";
import { Suspense } from "react";

import { PromotionForm } from "@/components/admin/promotion-form";
import { PromotionToggle } from "@/components/admin/promotion-toggle";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listPromotionTargets, listPromotions } from "@/features/promotions/queries";
import { requireAdmin } from "@/server/auth/guards";
import { formatDate } from "@/lib/utils/format-date";

export const metadata: Metadata = {
  title: "Promotions",
  description: "Schedule marketplace, studio, and department promotions.",
  robots: { index: false, follow: false },
};

export default function AdminPromotionsPage() {
  return (
    <Suspense fallback={<AdminPromotionsSkeleton />}>
      <AdminPromotionsContent />
    </Suspense>
  );
}

async function AdminPromotionsContent() {
  const [admin, promotions, targets] = await Promise.all([
    requireAdmin(),
    listPromotions(),
    listPromotionTargets(),
  ]);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 border-b border-border pb-8">
        <div className="max-w-2xl">
          <p className="eyebrow text-muted-foreground">Administration</p>
          <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
            Promotions.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Promotions apply automatically at checkout while they run — no code needed. Only the
            single best live promotion applies to an order, and it only discounts the objects it
            covers. The platform funds the discount, so studio subtotals and payouts stay whole.
          </p>
          <p className="mt-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            Signed in as {admin.name}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section aria-labelledby="promotion-list-heading">
          <h2 id="promotion-list-heading" className="font-display text-xl font-medium">
            Scheduled promotions
          </h2>

          {promotions.length === 0 ? (
            <EmptyState
              icon={<Percent className="size-5" aria-hidden="true" />}
              title="No promotions yet."
              description="Create the first one with the form beside this list."
            />
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
              {promotions.map((promotion) => (
                <li
                  key={promotion.id}
                  className="flex flex-wrap items-start justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{promotion.name}</span>
                      <Badge tone={promotion.isActive ? "success" : "neutral"}>
                        {promotion.isActive ? "Running" : "Paused"}
                      </Badge>
                    </div>
                    {promotion.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{promotion.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {promotion.percent}% off · {promotion.targetName} · {promotion.currency} ·{" "}
                      {promotion.orderCount} {promotion.orderCount === 1 ? "order" : "orders"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      From {formatDate(promotion.startsAt)}
                      {promotion.endsAt ? ` to ${formatDate(promotion.endsAt)}` : ", no end date"}
                    </p>
                  </div>

                  <PromotionToggle promotionId={promotion.id} isActive={promotion.isActive} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="promotion-create-heading"
          className="h-fit rounded-xl border border-border bg-surface p-6"
        >
          <h2 id="promotion-create-heading" className="font-display text-xl font-medium">
            New promotion
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            The discount is taken from eligible object totals. Coupon codes still apply on top.
          </p>
          <PromotionForm
            currency={promotions[0]?.currency ?? "TZS"}
            vendors={targets.vendors}
            categories={targets.categories}
          />
        </section>
      </div>
    </PageShell>
  );
}

function AdminPromotionsSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading promotions" className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </PageShell>
  );
}
