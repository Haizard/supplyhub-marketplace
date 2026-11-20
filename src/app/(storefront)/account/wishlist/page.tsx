import type { Metadata } from "next";
import { ArrowLeft, Heart } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell } from "@/components/storefront/page-shell";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listWishlistProducts } from "@/features/wishlist/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Saved objects",
  description: "Objects you saved for later on your SupplyHub account.",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <Suspense fallback={<WishlistSkeleton />}>
      <WishlistContent />
    </Suspense>
  );
}

async function WishlistContent() {
  const [actor, { t }] = await Promise.all([requireActor("/account/wishlist"), getServerI18n()]);
  const products = await listWishlistProducts(actor.id);

  return (
    <PageShell className="pt-10 sm:pt-14">
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("account.account")}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div>
          <p className="eyebrow text-muted-foreground">{t("wishlist.eyebrow")}</p>
          <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] sm:text-5xl">
            {t("wishlist.title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("wishlist.description")}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {products.length === 1
            ? t("wishlist.countOne")
            : t("wishlist.count", { count: products.length })}
        </p>
      </div>

      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-5" aria-hidden="true" />}
            title={t("wishlist.emptyTitle")}
            description={t("wishlist.emptyBody")}
          >
            <Button asChild>
              <Link href="/products">{t("wishlist.browse")}</Link>
            </Button>
          </EmptyState>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </PageShell>
  );
}

function WishlistSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-6 h-12 w-72" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/5] w-full rounded-xl" />
        ))}
      </div>
    </PageShell>
  );
}
