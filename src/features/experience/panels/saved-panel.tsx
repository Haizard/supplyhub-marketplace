"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bell, Heart } from "lucide-react";

import { WishlistToggle } from "@/components/storefront/wishlist-toggle";
import type { ProductListing } from "@/features/catalog/types";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

import { useExperience } from "../store";
import { formatCents } from "../types";

export function SavedPanel({
  products,
  savedProducts,
  viewerId,
}: {
  products: ProductListing[];
  savedProducts: ProductListing[];
  viewerId: string | null;
}) {
  const t = useT();
  const { checkWatch } = useExperience();

  // Price-drop and restock alerts remain a local device aid; the saved list
  // itself is account-backed and comes from the database.
  useEffect(() => {
    checkWatch(
      products.map((p) => ({
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        inventory: p.inventory,
        image: p.image.src,
        currency: p.currency,
      })),
    );
  }, [products, checkWatch]);

  if (!viewerId) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <Heart className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-medium">
          {t("experience.saved.signInTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("experience.saved.signInBody")}
        </p>
        <Link
          href="/sign-in?next=%2Fexperience%3Ftab%3Dsaved"
          className="mt-4 inline-flex rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e]/90"
        >
          {t("experience.saved.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-medium">
            <Heart className="size-5 text-accent" /> {t("experience.saved.title")}
            <span className="text-sm font-normal text-muted-foreground">
              ({savedProducts.length})
            </span>
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-1 text-[0.6875rem] font-semibold text-[#0f766e]">
            <Bell className="size-3.5" /> {t("experience.saved.watching")}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("experience.saved.body")}</p>

        {savedProducts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <Heart className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {t("experience.saved.empty")} {t("experience.saved.emptyBody")}
            </p>
            <Link
              href="/products"
              className="mt-3 inline-block rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white"
            >
              {t("home.shopNow")}
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {savedProducts.map((p) => (
              <li
                key={p.slug}
                className="relative flex gap-3 rounded-xl border border-border bg-surface p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image.src}
                  alt={p.image.alt}
                  className="size-20 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${p.slug}`}
                    className="block truncate text-sm font-semibold hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{p.vendor.name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0f766e]">
                    {formatCents(p.priceCents, p.currency)}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      p.inventory > 0 ? "text-muted-foreground" : "text-[#b45309]",
                    )}
                  >
                    {p.inventory > 0 ? `${p.inventory} in stock` : t("common.outOfStock")}
                  </p>
                </div>
                <WishlistToggle
                  className="absolute top-2 right-2 size-7 rounded-full border-0 bg-surface/90 shadow-none"
                  productId={p.id}
                  productName={p.name}
                  saved
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
