"use client";

import { Heart } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { toggleWishlistAction } from "@/features/wishlist/actions";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

export function WishlistToggle({
  productId,
  productName,
  saved,
  className,
}: {
  productId: string;
  productName: string;
  saved: boolean;
  className?: string;
}) {
  const t = useT();
  const [isSaved, setOptimisticSaved] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      setOptimisticSaved(!isSaved);

      try {
        const result = await toggleWishlistAction(productId);
        setOptimisticSaved(result.saved);
      } catch {
        setOptimisticSaved(saved);
      }
    });
  }

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={
        isSaved
          ? t("wishlist.removeNamed", { name: productName })
          : t("wishlist.addNamed", { name: productName })
      }
      title={isSaved ? t("wishlist.savedTitle") : t("wishlist.addTitle")}
      onClick={toggle}
      disabled={pending}
      className={cn(
        "pointer-events-auto grid size-9 place-items-center rounded-full border border-border bg-surface/90 text-muted-foreground shadow-sm backdrop-blur transition hover:scale-105 hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-70",
        isSaved && "border-accent/40 text-accent",
        className,
      )}
    >
      <Heart className={cn("size-4 transition", isSaved && "fill-accent")} aria-hidden="true" />
    </button>
  );
}
