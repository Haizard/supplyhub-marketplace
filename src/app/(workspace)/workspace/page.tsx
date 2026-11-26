import type { Metadata } from "next";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionLauncher } from "@/components/workspace/action-launcher";
import { workspaceIcon } from "@/components/workspace/icons";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import {
  actionsFor,
  availableExperiences,
  buildAttention,
  greetingKey,
  navFor,
  resolveExperience,
  tasksFor,
  type ExperienceId,
} from "@/features/workspace/experience";
import { getWorkspaceSnapshot, type WorkspaceSnapshot } from "@/features/workspace/queries";
import { getServerI18n } from "@/i18n/server";
import { getSessionActor } from "@/server/auth/session";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "My day",
  description: "What you can do, what needs your attention, and how your business is doing today.",
  robots: { index: false, follow: false },
};

export default function WorkspacePage({ searchParams }: PageProps<"/workspace">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <WorkspaceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkspaceContent({
  searchParams,
}: {
  searchParams: PageProps<"/workspace">["searchParams"];
}) {
  const [actor, { t, formatCurrency }, params] = await Promise.all([
    getSessionActor(),
    getServerI18n(),
    searchParams,
  ]);

  const snapshot = actor ? await getWorkspaceSnapshot(actor) : null;

  const experiences = snapshot
    ? availableExperiences({
        seller: Boolean(snapshot.seller),
        farmer: Boolean(snapshot.farmer),
        logistics: Boolean(snapshot.logistics),
        buyer: true,
        courier: Boolean(snapshot.courier),
      })
    : ["buyer" as ExperienceId];
  const experience = resolveExperience(params.as, experiences);
  const context = { logisticsCompanyId: snapshot?.logistics?.companyId ?? null };
  const nav = navFor(experience, context);

  if (!actor || !snapshot) {
    return (
      <WorkspaceShell
        businesses={[]}
        activeBusinessId={null}
        experiences={experiences}
        activeExperience={experience}
        nav={nav}
      >
        <EmptyState title={t("workspace.signIn.title")} description={t("workspace.signIn.body")}>
          <Button asChild>
            <Link href="/sign-in?next=%2Fworkspace">{t("workspace.signIn.action")}</Link>
          </Button>
        </EmptyState>
      </WorkspaceShell>
    );
  }

  const attention = buildAttention(experience, {
    ordersToPrepare: snapshot.seller?.ordersToPrepare ?? 0,
    paymentsDue: snapshot.seller?.paymentsDue ?? 0,
    lowStock: snapshot.seller?.lowStock ?? 0,
    unreadMessages:
      experience === "seller"
        ? (snapshot.seller?.unreadMessages ?? 0)
        : snapshot.buyer.unreadMessages,
    activeDeliveries:
      experience === "logistics"
        ? (snapshot.logistics?.activeJobs ?? 0)
        : (snapshot.courier?.activeDeliveries ?? 0),
    buyerOpenOrders: snapshot.buyer.openOrders,
    savedProducts: snapshot.buyer.savedProducts,
    pendingAgreements: snapshot.farmer?.pendingAgreements ?? 0,
    openOpportunities: snapshot.logistics?.openOpportunities ?? 0,
    logisticsCompanyId: snapshot.logistics?.companyId ?? null,
  });

  // Business accounts are named after the business, so the whole display name is
  // kinder than slicing it to its first word — and the business itself reads
  // best in the welcome line when there is one.
  const displayName = snapshot.business?.name ?? actor.name.trim();
  const tasks = tasksFor(experience, context);
  const today = todaySummary(experience, snapshot, t, formatCurrency);

  return (
    <WorkspaceShell
      businesses={snapshot.businesses}
      activeBusinessId={snapshot.business?.id ?? null}
      experiences={experiences}
      activeExperience={experience}
      nav={nav}
    >
      <header>
        <p className="eyebrow text-muted-foreground">{t(greetingKey(new Date().getHours()))}</p>
        <h1 className="mt-1.5 font-display text-3xl leading-tight font-medium tracking-[-0.035em] text-balance sm:text-4xl">
          {displayName ? t("workspace.welcome", { name: displayName }) : t("workspace.todayTitle")}
        </h1>
        {snapshot.business && snapshot.businesses.length > 1 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("workspace.businessLabel")}:{" "}
            <span className="font-medium text-foreground">{snapshot.business.name}</span>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="today-heading" className="mt-6">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p id="today-heading" className="eyebrow text-muted-foreground">
                {today.eyebrow}
              </p>
              <p className="mt-2 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-foreground tabular-nums sm:text-5xl">
                {today.value}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{today.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{today.note}</p>
            </div>

            {experience === "courier" && snapshot.courier ? (
              <Badge tone={snapshot.courier.presence === "ONLINE" ? "success" : "neutral"}>
                {snapshot.courier.presence}
              </Badge>
            ) : null}

            {today.stats.length > 0 ? (
              <dl className="flex w-full flex-wrap gap-x-8 gap-y-4 border-t border-border pt-4 sm:w-auto sm:self-end sm:border-t-0 sm:pt-0">
                {today.stats.map((stat) => (
                  <div key={stat.label} className="min-w-[5.5rem]">
                    <dt className="text-[0.6875rem] leading-4 text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 font-mono text-lg font-semibold text-foreground tabular-nums">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="tasks-heading" className="mt-8">
        <h2 id="tasks-heading" className="font-display text-xl font-semibold tracking-[-0.02em]">
          {t("workspace.tasksTitle")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("workspace.tasksSubtitle")}
        </p>

        <div className="mt-4">
          <ActionLauncher actions={actionsFor(experience, context)} experience={experience} />
        </div>

        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {tasks.map((task) => {
            const Icon = workspaceIcon(task.icon);
            return (
              <li key={task.id}>
                <Link
                  href={task.href}
                  className="group flex h-full items-start gap-3.5 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-muted text-foreground group-hover:bg-surface">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {t(task.labelKey)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {t(task.bodyKey)}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="attention-heading" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="attention-heading"
            className="font-display text-xl font-semibold tracking-[-0.02em]"
          >
            {t("workspace.attentionTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("workspace.attentionBody")}</p>
        </div>

        {attention.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {attention.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums",
                      item.tone === "warning" ? "bg-clay-soft text-clay" : "bg-sky text-sky-ink",
                    )}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {t(item.labelKey, { count: item.count })}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {t(item.bodyKey)}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border-strong/60 bg-surface/60 px-4 py-6 text-sm text-muted-foreground">
            {t("workspace.attentionEmpty")}
          </p>
        )}
      </section>

      {experience === "seller" && snapshot.seller?.publishedProducts === 0 ? (
        <section
          aria-labelledby="start-heading"
          className="mt-8 rounded-2xl border border-border bg-sand-soft/40 p-5 sm:p-6"
        >
          <p className="eyebrow text-sage">{t("workspace.startHereTitle")}</p>
          <h2
            id="start-heading"
            className="mt-2 font-display text-xl font-medium tracking-[-0.02em]"
          >
            {t("workspace.startHereBody")}
          </h2>
          <ol className="mt-4 space-y-2.5">
            {[
              {
                href: "/workspace/sell",
                label: t("workspace.startHere.firstProduct"),
                body: t("workspace.startHere.firstProductBody"),
              },
              {
                href: "/vendor/inventory",
                label: t("workspace.startHere.checkStock"),
                body: t("workspace.startHere.checkStockBody"),
              },
              {
                href: "/vendor/earnings",
                label: t("workspace.startHere.seeMoney"),
                body: t("workspace.startHere.seeMoneyBody"),
              },
            ].map((step, index) => (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{step.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {step.body}
                    </span>
                  </span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

type Translator = Awaited<ReturnType<typeof getServerI18n>>["t"];
type CurrencyFormatter = Awaited<ReturnType<typeof getServerI18n>>["formatCurrency"];

interface TodaySummary {
  eyebrow: string;
  value: string;
  label: string;
  note: string;
  stats: Array<{ label: string; value: number }>;
}

/**
 * The one number that answers "how is today going?" for the active view. Keeping
 * it as data stops the card from growing a nested conditional per role.
 */
function todaySummary(
  experience: ExperienceId,
  snapshot: WorkspaceSnapshot,
  t: Translator,
  formatCurrency: CurrencyFormatter,
): TodaySummary {
  if (experience === "seller" && snapshot.seller) {
    return {
      eyebrow: t("workspace.todayTitle"),
      value: formatCurrency(snapshot.seller.salesTodayCents, snapshot.seller.currency),
      label: t("workspace.salesToday"),
      note: t("workspace.salesNote"),
      stats: [
        { label: t("workspace.openOrders"), value: snapshot.seller.ordersToPrepare },
        { label: t("workspace.paymentsDue"), value: snapshot.seller.paymentsDue },
        { label: t("workspace.lowStock"), value: snapshot.seller.lowStock },
      ],
    };
  }

  if (experience === "farmer" && snapshot.farmer) {
    return {
      eyebrow: t("workspace.farmerToday"),
      value: String(snapshot.farmer.activeCrops),
      label: t("workspace.cropsGrowing"),
      note: t("workspace.farmerTodayNote"),
      stats: [
        { label: t("workspace.pendingAgreements"), value: snapshot.farmer.pendingAgreements },
        { label: t("workspace.activeGroups"), value: snapshot.farmer.activeGroups },
      ],
    };
  }

  if (experience === "logistics" && snapshot.logistics) {
    return {
      eyebrow: t("workspace.logisticsToday"),
      value: String(snapshot.logistics.activeJobs),
      label: t("workspace.activeJobs"),
      note: t("workspace.logisticsTodayNote"),
      stats: [
        { label: t("workspace.teamMembers"), value: snapshot.logistics.activeMembers },
        { label: t("workspace.openOpportunities"), value: snapshot.logistics.openOpportunities },
      ],
    };
  }

  if (experience === "courier") {
    return {
      eyebrow: t("workspace.courierToday"),
      value: String(snapshot.courier?.activeDeliveries ?? 0),
      label: t("workspace.activeDeliveries"),
      note: t("workspace.courierTodayNote"),
      stats: [],
    };
  }

  return {
    eyebrow: t("workspace.buyerToday"),
    value: String(snapshot.buyer.openOrders),
    label: t("workspace.openOrders"),
    note: t("workspace.buyerTodayNote"),
    stats: [
      { label: t("workspace.savedProducts"), value: snapshot.buyer.savedProducts },
      { label: t("workspace.unreadMessages"), value: snapshot.buyer.unreadMessages },
    ],
  };
}

function WorkspaceSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6"
      role="status"
      aria-label="Loading your workspace"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      <Skeleton className="mt-6 h-44 w-full rounded-2xl" />
      <Skeleton className="mt-8 h-14 w-full rounded-xl" />
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
