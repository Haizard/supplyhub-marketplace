import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/storefront/wordmark";
import { Button } from "@/components/ui/button";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { switchActiveBusinessAction } from "@/features/business/session-actions";
import { signOutAction } from "@/features/identity/actions";
import type { ExperienceId, WorkspaceNavItem } from "@/features/workspace/experience";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { getServerI18n } from "@/i18n/server";
import { cn } from "@/lib/utils/cn";

export interface WorkspaceShellProps {
  businesses: Array<{ id: string; name: string }>;
  activeBusinessId: string | null;
  experiences: ExperienceId[];
  activeExperience: ExperienceId;
  nav: WorkspaceNavItem[];
  children: ReactNode;
}

/**
 * The mobile-app shell for the task-first workspace.
 *
 * On a phone: a compact header, the content, and five persistent destinations.
 * On desktop: the same information architecture with an inline navigation row.
 */
export async function WorkspaceShell({
  businesses,
  activeBusinessId,
  experiences,
  activeExperience,
  nav,
  children,
}: WorkspaceShellProps) {
  const { t } = await getServerI18n();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto w-full max-w-[1000px] px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3">
            <Link
              href="/"
              aria-label="SupplyHub home"
              className="inline-flex shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
            >
              <Wordmark compact />
            </Link>

            <div className="ml-auto flex min-w-0 items-center gap-1">
              {businesses.length > 1 ? (
                <form
                  action={switchActiveBusinessAction}
                  className="hidden items-center gap-1.5 sm:flex"
                >
                  <input type="hidden" name="next" value="/workspace" />
                  <label htmlFor="workspace-business" className="sr-only">
                    {t("workspace.businessLabel")}
                  </label>
                  <select
                    id="workspace-business"
                    name="businessId"
                    defaultValue={activeBusinessId ?? undefined}
                    className="h-8 max-w-[11rem] rounded-md border border-border bg-surface px-2 text-xs text-foreground"
                  >
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary" size="sm" className="h-8">
                    {t("workspace.switchBusiness")}
                  </Button>
                </form>
              ) : null}

              <LanguageSwitcher compact />

              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  aria-label={t("account.signOut")}
                  className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
          </div>

          <div
            className={cn(
              "h-12 items-center gap-2 overflow-x-auto pb-1",
              experiences.length > 1 ? "flex" : "hidden md:flex",
            )}
          >
            <WorkspaceNav items={nav} layout="inline" />

            <div
              className="flex items-center gap-1 md:ml-auto"
              role="group"
              aria-label={t("workspace.viewLabel")}
            >
              {experiences.length > 1
                ? experiences.map((experience) => (
                    <Link
                      key={experience}
                      href={`/workspace?as=${experience}`}
                      aria-current={experience === activeExperience ? "true" : undefined}
                      className={cn(
                        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
                        experience === activeExperience
                          ? "border-accent/30 bg-accent-soft text-accent"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`workspace.views.${experience}`)}
                    </Link>
                  ))
                : null}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 pb-28 md:pb-12">
        <div className="mx-auto w-full max-w-[1000px] px-4 pt-6 sm:px-6 sm:pt-8">{children}</div>
      </main>

      <WorkspaceNav items={nav} layout="bottom" />
    </div>
  );
}
