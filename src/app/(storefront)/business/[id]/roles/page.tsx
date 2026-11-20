import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RoleForm } from "@/components/business/role-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBusinessById,
  listAllPermissions,
  listRolesForBusiness,
} from "@/features/business/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";
import {
  BusinessAccessError,
  hasPermission,
  resolveBusinessContext,
} from "@/server/business/context";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Business roles",
  robots: { index: false, follow: false },
};

export default function RolesPage({ params }: Props) {
  return (
    <Suspense fallback={<RolesSkeleton />}>
      <RolesContent params={params} />
    </Suspense>
  );
}

async function RolesContent({ params }: Props) {
  const { id } = await params;
  const actor = await requireActor(`/business/${id}/roles`);
  const { t } = await getServerI18n();

  const business = await getBusinessById(id);
  if (!business) notFound();

  const ctx = await resolveBusinessContext(actor, id).catch((error: unknown) => {
    if (error instanceof BusinessAccessError) notFound();
    throw error;
  });

  const [roles, permissions] = await Promise.all([listRolesForBusiness(id), listAllPermissions()]);
  const canManage = hasPermission(ctx, "business.update");

  return (
    <PageShell className="pt-10 sm:pt-14">
      <Link
        href={`/business/${id}`}
        className="inline-flex items-center gap-2 rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t("business.nav.back")}
      </Link>

      <p className="eyebrow mt-5 text-muted-foreground">{business.name}</p>
      <h1 className="mt-2 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance">
        {t("business.roles.heading")}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
        {t("business.roles.lead")}
      </p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section
          aria-labelledby="business-roles-heading"
          className="rounded-xl border border-border bg-surface"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 id="business-roles-heading" className="text-sm font-semibold">
              {t("business.roles.listHeading")}
            </h2>
          </div>

          {roles.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {t("business.roles.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {roles.map((role) => {
                const permissionKeys = role.permissions.map(
                  (entry) => entry.permission.permissionKey,
                );

                return (
                  <li key={role.id} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{role.name}</p>
                      <Badge tone={role.isSystem ? "neutral" : "accent"}>
                        {role.isSystem ? t("business.roles.system") : t("business.roles.custom")}
                      </Badge>
                    </div>

                    {permissionKeys.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("business.roles.noPermissions")}
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {permissionKeys.map((key) => (
                          <li
                            key={key}
                            className="rounded-sm border border-border bg-surface-muted px-2 py-1 font-mono text-[0.625rem] text-muted-foreground"
                          >
                            {key}
                          </li>
                        ))}
                      </ul>
                    )}

                    {role.isSystem ? (
                      <p className="text-xs text-muted-foreground">
                        {t("business.roles.systemNote")}
                      </p>
                    ) : null}

                    {canManage && !role.isSystem ? (
                      <details className="rounded-md border border-border bg-surface-muted/40 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium">
                          {t("business.roles.update")}
                        </summary>
                        <div className="mt-3">
                          <RoleForm
                            businessId={id}
                            permissions={permissions}
                            role={{ id: role.id, name: role.name, permissionKeys }}
                          />
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canManage ? (
          <section
            aria-labelledby="business-new-role-heading"
            className="rounded-xl border border-border bg-surface p-5"
          >
            <h2 id="business-new-role-heading" className="text-sm font-semibold">
              {t("business.roles.create")}
            </h2>
            <div className="mt-4">
              <RoleForm businessId={id} permissions={permissions} />
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

function RolesSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading business roles">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-6 h-10 w-48 max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
