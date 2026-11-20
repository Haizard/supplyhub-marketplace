import type { Metadata } from "next";
import { Tag } from "lucide-react";
import { Suspense } from "react";

import { CouponForm } from "@/components/admin/coupon-form";
import { CouponToggle } from "@/components/admin/coupon-toggle";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listCoupons } from "@/features/coupons/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Discount codes",
  description: "Issue and pause marketplace discount codes.",
  robots: { index: false, follow: false },
};

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={<AdminCouponsSkeleton />}>
      <AdminCouponsContent />
    </Suspense>
  );
}

function formatCouponValue(coupon: Awaited<ReturnType<typeof listCoupons>>[number]): string {
  return coupon.kind === "PERCENT"
    ? `${Number(coupon.value)}% off`
    : `${coupon.value} ${coupon.currency} off`;
}

async function AdminCouponsContent() {
  const [admin, coupons] = await Promise.all([requireAdmin(), listCoupons()]);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 border-b border-border pb-8">
        <div className="max-w-2xl">
          <p className="eyebrow text-muted-foreground">Administration</p>
          <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
            Discount codes.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Codes are redeemed at checkout. A code can be limited to a minimum basket, a number of
            uses, and a date window. Pausing a code keeps its history and stops new redemptions.
          </p>
          <p className="mt-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
            Signed in as {admin.name}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section aria-labelledby="coupon-list-heading">
          <h2 id="coupon-list-heading" className="font-display text-xl font-medium">
            Issued codes
          </h2>

          {coupons.length === 0 ? (
            <EmptyState
              icon={<Tag className="size-5" aria-hidden="true" />}
              title="No discount codes yet."
              description="Create the first code with the form beside this list."
            />
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
              {coupons.map((coupon) => (
                <li
                  key={coupon.id}
                  className="flex flex-wrap items-start justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium tracking-[0.08em]">
                        {coupon.code}
                      </span>
                      <Badge tone={coupon.isActive ? "success" : "neutral"}>
                        {coupon.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{coupon.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatCouponValue(coupon)} · {coupon.redemptions} used
                      {coupon.maxRedemptions === null ? "" : ` of ${coupon.maxRedemptions}`}
                      {coupon.minSubtotal === null
                        ? ""
                        : ` · minimum ${coupon.minSubtotal} ${coupon.currency}`}
                    </p>
                    {coupon.endsAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Expires {coupon.endsAt.toISOString().slice(0, 10)}
                      </p>
                    ) : null}
                  </div>

                  <CouponToggle couponId={coupon.id} isActive={coupon.isActive} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="coupon-create-heading"
          className="h-fit rounded-xl border border-border bg-surface p-6"
        >
          <h2 id="coupon-create-heading" className="font-display text-xl font-medium">
            New code
          </h2>
          <p className="mt-0 mb-5 text-sm text-muted-foreground">
            The platform funds the discount; studio payouts use the full subtotal.
          </p>
          <CouponForm currency={coupons[0]?.currency ?? "TZS"} />
        </section>
      </div>
    </PageShell>
  );
}

function AdminCouponsSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading discount codes" className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    </PageShell>
  );
}
