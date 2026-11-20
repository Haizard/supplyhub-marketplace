import { LogOut, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/storefront/wordmark";
import { Button } from "@/components/ui/button";
import { StudioSidebar } from "@/components/vendor/studio-nav";
import { StudioBottomNav } from "@/components/vendor/studio-bottom-nav";
import { VendorStatusBadge } from "@/components/vendors/vendor-status-badge";
import { switchActiveBusinessAction } from "@/features/business/session-actions";
import { signOutAction } from "@/features/identity/actions";
import type { VendorStatus } from "@/generated/prisma/enums";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { getServerI18n } from "@/i18n/server";

export interface StudioShellProps {
  studio: {
    name: string;
    slug: string | null;
    monogram: string;
    status: VendorStatus | null;
  };
  /** Every business the signed-in member can act as. */
  businesses?: { id: string; name: string }[];
  activeBusinessId?: string | null;
  isOwner?: boolean;
  children: ReactNode;
}

export async function StudioShell({
  studio,
  businesses = [],
  activeBusinessId = null,
  isOwner = true,
  children,
}: StudioShellProps) {
  const approved = studio.status === "APPROVED";
  const { t } = await getServerI18n();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Link
            href="/"
            aria-label="SupplyHub home"
            className="inline-flex shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
          >
            <Wordmark compact />
          </Link>

          <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-border sm:block" />

          <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display text-[0.6875rem] font-semibold text-primary-foreground"
            >
              {studio.monogram}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] leading-tight font-semibold tracking-[-0.01em]">
                {studio.name}
              </p>
              <p className="text-[0.625rem] leading-tight text-muted-foreground">
                {isOwner ? t("studio.ownerAccount") : t("studio.memberAccount")}
              </p>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            {businesses.length > 1 ? (
              <form
                action={switchActiveBusinessAction}
                className="hidden items-center gap-1.5 lg:flex"
              >
                <label htmlFor="active-business" className="sr-only">
                  {t("studio.businessSwitcher")}
                </label>
                <select
                  id="active-business"
                  name="businessId"
                  defaultValue={activeBusinessId ?? undefined}
                  className="h-8 max-w-[10rem] rounded-md border border-border bg-surface px-2 text-xs text-foreground"
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary" size="sm" className="h-8">
                  {t("studio.switchBusiness")}
                </Button>
              </form>
            ) : null}
            <LanguageSwitcher compact />
            {studio.status ? (
              <VendorStatusBadge
                status={studio.status}
                className="hidden rounded-full font-sans text-[0.6563rem] font-medium tracking-normal normal-case sm:inline-flex"
              />
            ) : null}
            {approved && studio.slug ? (
              <Button asChild variant="secondary" size="sm" className="hidden lg:inline-flex">
                <Link href={`/vendors/${studio.slug}`}>{t("studio.viewStorefront")}</Link>
              </Button>
            ) : null}
            {approved ? (
              <Button asChild size="sm" className="px-2.5 sm:px-3">
                <Link href="/vendor/products/new" aria-label={t("studio.addObject")}>
                  <Plus className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{t("studio.addObject")}</span>
                </Link>
              </Button>
            ) : null}
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                aria-label={t("account.signOut")}
                className="gap-1.5 px-2 text-muted-foreground hover:text-foreground sm:px-3"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("account.signOut")}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="studio-bottom-nav-clearance flex-1">
        <div className="mx-auto flex w-full max-w-[1360px] gap-6 px-4 py-6 sm:px-6 sm:py-8">
          {approved ? (
            <aside className="hidden w-52 shrink-0 lg:block">
              <div className="sticky top-20">
                <StudioSidebar />
              </div>
            </aside>
          ) : null}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>

      {approved ? <StudioBottomNav /> : null}
    </div>
  );
}
