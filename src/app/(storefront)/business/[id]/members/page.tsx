import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { InviteMemberForm } from "@/components/business/invite-member-form";
import { RemoveMemberForm } from "@/components/business/remove-member-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBusinessById,
  listMembersForBusiness,
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
  title: "Business members",
  robots: { index: false, follow: false },
};

export default function MembersPage({ params }: Props) {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <MembersContent params={params} />
    </Suspense>
  );
}

async function MembersContent({ params }: Props) {
  const { id } = await params;
  const actor = await requireActor(`/business/${id}/members`);
  const { t, formatDate } = await getServerI18n();

  const business = await getBusinessById(id);
  if (!business) notFound();

  const ctx = await resolveBusinessContext(actor, id).catch((error: unknown) => {
    if (error instanceof BusinessAccessError) notFound();
    throw error;
  });

  const [members, roles] = await Promise.all([
    listMembersForBusiness(id),
    listRolesForBusiness(id),
  ]);
  const canManage = hasPermission(ctx, "business.members.manage");

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
        {t("business.members.heading")}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
        {t("business.members.lead")}
      </p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section
          aria-labelledby="business-members-heading"
          className="rounded-xl border border-border bg-surface"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 id="business-members-heading" className="text-sm font-semibold">
              {t("business.members.listHeading")}
            </h2>
          </div>

          {members.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {t("business.members.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const isOwner = member.roles.some(
                  (entry) => entry.role.isSystem && entry.role.name === "owner",
                );
                const statusLabel =
                  member.status === "active"
                    ? t("business.members.statusActive")
                    : member.status === "removed"
                      ? t("business.members.statusRemoved")
                      : t("business.members.statusSuspended");

                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{member.user.name}</span>
                        {isOwner ? (
                          <Badge tone="accent">{t("business.members.owner")}</Badge>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                      <p className="mt-1.5 font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground uppercase">
                        {member.roles.map((entry) => entry.role.name).join(" · ") || "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("business.members.joined", { date: formatDate(member.createdAt) })}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Badge tone={member.status === "active" ? "success" : "neutral"}>
                        {statusLabel}
                      </Badge>
                      {canManage && !isOwner && member.status === "active" ? (
                        <RemoveMemberForm businessId={id} memberId={member.id} />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canManage ? (
          <section
            aria-labelledby="business-invite-heading"
            className="rounded-xl border border-border bg-surface p-5"
          >
            <h2 id="business-invite-heading" className="text-sm font-semibold">
              {t("business.members.invite")}
            </h2>
            <div className="mt-4">
              <InviteMemberForm businessId={id} roles={roles} />
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

function MembersSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading business members">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-6 h-10 w-56 max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-lg" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </PageShell>
  );
}
