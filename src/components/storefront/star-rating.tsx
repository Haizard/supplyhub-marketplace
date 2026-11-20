import { Star } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function StarRating({
  rating,
  className,
  label,
}: {
  rating: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={label}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(
            "size-3.5",
            star <= Math.round(rating) ? "fill-clay text-clay" : "text-border-strong",
          )}
        />
      ))}
    </span>
  );
}
