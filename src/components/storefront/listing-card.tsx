import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The retail product card is the visual anchor of the storefront: a square media
 * plate, the price first, then the name, a one-line summary and a maker label at
 * the bottom. Produce, logistics and service listings reuse that skeleton so the
 * three networks read as one catalogue rather than three admin tables.
 */
const mediaTones = {
  farm: "bg-gradient-to-br from-sage-soft via-surface to-sand-soft text-sage",
  logistics: "bg-gradient-to-br from-sky via-surface to-surface-muted text-sky-ink",
  services: "bg-gradient-to-br from-clay-soft via-surface to-sand-soft text-clay",
} as const;

export type ListingTone = keyof typeof mediaTones;

export function ListingCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("group flex h-full flex-col", className)}>{children}</article>;
}

export function ListingMedia({
  tone,
  icon,
  image,
  imageAlt,
  label,
  badge,
  href,
}: {
  tone: ListingTone;
  icon: ReactNode;
  image?: string | null;
  imageAlt?: string;
  label?: string | null;
  badge?: ReactNode;
  href?: string;
}) {
  const plate = (
    <div className={cn("media-square relative w-full overflow-hidden", !image && mediaTones[tone])}>
      {image ? (
        <Image
          src={image}
          alt={imageAlt ?? ""}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 96vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
        />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <span className="grid size-[42%] max-h-24 max-w-24 place-items-center rounded-full border border-current/20 bg-surface/60 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset] transition-transform duration-500 ease-out group-hover:scale-[1.06]">
              {icon}
            </span>
          </div>
        </>
      )}
      {label ? (
        <p
          className={cn(
            "absolute inset-x-3 bottom-2.5 truncate font-mono text-[0.5625rem] tracking-[0.14em] uppercase",
            image
              ? "w-fit rounded-sm bg-surface/90 px-1.5 py-0.5 text-foreground backdrop-blur"
              : "opacity-80",
          )}
        >
          {label}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface-muted transition-[border-color,box-shadow] duration-300 group-hover:border-border-strong group-hover:shadow-[0_10px_30px_-18px_rgb(11_16_32/0.35)]">
      {href ? (
        <Link href={href} aria-hidden="true" tabIndex={-1} className="block">
          {plate}
        </Link>
      ) : (
        plate
      )}
      {badge ? (
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {badge}
        </div>
      ) : null}
    </div>
  );
}

export function ListingBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-1 flex-col pt-3", className)}>{children}</div>;
}

export function ListingPrice({ children, suffix }: { children: ReactNode; suffix?: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 font-semibold">
      <span className="text-base tabular-nums">{children}</span>
      {suffix ? <span className="text-xs font-normal text-muted-foreground">{suffix}</span> : null}
    </p>
  );
}

export function ListingTitle({ href, children }: { href?: string; children: ReactNode }) {
  return (
    <h3 className="mt-1.5 line-clamp-2 text-sm leading-5 font-medium tracking-[-0.01em] sm:text-[0.9375rem] sm:leading-6">
      {href ? (
        <Link
          href={href}
          className="underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          {children}
        </Link>
      ) : (
        children
      )}
    </h3>
  );
}

export function ListingSummary({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-[0.8125rem]">
      {children}
    </p>
  );
}

export function ListingFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto pt-2.5">{children}</div>;
}

/** Mirrors the retail `MakerLabel` inline form: monogram, seller, place. */
export function ProviderLabel({
  name,
  meta,
  className,
}: {
  name: string;
  meta?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter((part) => /[\p{L}\p{N}]/u.test(part))
    .slice(0, 2)
    .map((part) => (part.match(/[\p{L}\p{N}]/u)?.[0] ?? "").toUpperCase())
    .join("");

  return (
    <span
      className={cn(
        "flex max-w-full min-w-0 items-center gap-2 font-mono text-[0.625rem] tracking-[0.13em] text-muted-foreground uppercase",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-[18px] shrink-0 place-items-center rounded-[2px] border border-clay/30 bg-paper font-display text-[0.5rem] leading-none font-semibold text-clay"
      >
        {initials || "·"}
      </span>
      <span className="min-w-0 truncate">{name}</span>
      {meta ? (
        <>
          <span aria-hidden="true" className="text-border-strong">
            /
          </span>
          <span className="min-w-0 truncate">{meta}</span>
        </>
      ) : null}
    </span>
  );
}
