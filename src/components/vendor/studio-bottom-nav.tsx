"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { studioMoreTabs, studioPrimaryTabs } from "@/components/vendor/studio-nav";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

// Seller-only mobile bottom bar. Five slots at most: the four daily destinations
// plus "More", which opens the full list. Labels stay readable on a 360 px phone.
export function StudioBottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const moreActive = studioMoreTabs.some((tab) => tab.active(pathname));

  return (
    <nav
      aria-label={t("studio.nav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-between px-1.5">
        {studioPrimaryTabs.map((tab) => {
          const active = tab.active(pathname);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              aria-label={t(tab.labelKey)}
              className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <span
                className={cn(
                  "relative grid h-7 w-11 place-items-center rounded-full transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground group-hover:bg-surface-muted group-hover:text-foreground",
                )}
              >
                <tab.icon className="size-5" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "w-full truncate px-0.5 text-center text-[0.625rem] leading-none tracking-[0.01em]",
                  active ? "font-semibold text-accent" : "font-medium text-muted-foreground",
                )}
              >
                {t(
                  "mobileLabelKey" in tab && tab.mobileLabelKey ? tab.mobileLabelKey : tab.labelKey,
                )}
              </span>
            </Link>
          );
        })}

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={t("studio.more")}
              className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <span
                className={cn(
                  "grid h-7 w-11 place-items-center rounded-full transition-colors",
                  moreActive
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground group-hover:bg-surface-muted group-hover:text-foreground",
                )}
              >
                <MoreHorizontal className="size-5" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "w-full truncate px-0.5 text-center text-[0.625rem] leading-none tracking-[0.01em]",
                  moreActive ? "font-semibold text-accent" : "font-medium text-muted-foreground",
                )}
              >
                {t("studio.more")}
              </span>
            </button>
          </DialogTrigger>

          <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("studio.moreTitle")}</DialogTitle>
              <DialogDescription>{t("studio.moreBody")}</DialogDescription>
            </DialogHeader>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {studioMoreTabs.map((tab) => {
                const active = tab.active(pathname);

                return (
                  <li key={tab.href}>
                    <DialogClose asChild>
                      <Link
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          active
                            ? "border-accent/30 bg-accent-soft font-medium text-accent"
                            : "border-border text-foreground hover:bg-surface-muted",
                        )}
                      >
                        <tab.icon
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-accent" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{t(tab.labelKey)}</span>
                      </Link>
                    </DialogClose>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
}
