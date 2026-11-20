import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StudioPageHead } from "@/components/vendor/studio-page-head";
import { dayKey, parseReportRange, REPORT_RANGES, type ReportRange } from "@/features/pos/report";
import { getPosReport, type PosReport } from "@/features/pos/report-queries";
import { getServerI18n } from "@/i18n/server";
import { cn } from "@/lib/utils/cn";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Retail report",
  description: "Counter sales, cash, expenses, and register reconciliation.",
  robots: { index: false, follow: false },
};

type ReportParams = Promise<Record<string, string | string[] | undefined>>;

export default function PosReportPage({ searchParams }: { searchParams: ReportParams }) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportContent({ searchParams }: { searchParams: ReportParams }) {
  const [access, params, { t, formatCurrency, formatDate, formatTime }] = await Promise.all([
    requireStudioAccess("pos.sale.create", "/vendor/pos/report"),
    searchParams,
    getServerI18n(),
  ]);

  const rawDays = params.days;
  const days = parseReportRange(Array.isArray(rawDays) ? rawDays[0] : rawDays);
  const report = await getPosReport(access.vendorId, days);

  const money = (cents: number) => formatCurrency(cents, report.currency);
  const amount = (cents: number) => (cents === 0 ? "—" : money(cents));
  const dayLabel = (date: Date) =>
    formatDate(date, { weekday: "short", day: "numeric", month: "short" });
  const clock = (date: Date) => formatTime(date, { hour: "2-digit", minute: "2-digit" });
  // A session can stay open overnight, so the opening time carries its date when
  // it falls on a different day from the close.
  const openedLabel = (openedAt: Date, closedAt: Date | null) =>
    closedAt && dayKey(openedAt) !== dayKey(closedAt)
      ? `${formatDate(openedAt, { day: "numeric", month: "short" })}, ${clock(openedAt)}`
      : clock(openedAt);

  return (
    <>
      <StudioPageHead
        title={t("pos.reportTitle")}
        description={t("pos.reportDescription")}
        action={
          <>
            <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
              {REPORT_RANGES.map((range) => (
                <Link
                  key={range}
                  href={`/vendor/pos/report?days=${range}`}
                  aria-current={days === range ? "page" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    days === range
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {range === 7 ? t("pos.last7Days") : t("pos.last30Days")}
                </Link>
              ))}
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/vendor/pos">{t("pos.backToPos")}</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label={t("pos.grossSales")} value={money(report.totals.grossCents)} />
        <SummaryCard label={t("pos.costOfGoods")} value={money(report.totals.costCents)} />
        <SummaryCard label={t("pos.grossProfit")} value={money(report.totals.profitCents)} />
        <SummaryCard label={t("pos.cashSales")} value={money(report.totals.cashCents)} />
        <SummaryCard label={t("pos.expensesToday")} value={money(report.totals.expensesCents)} />
        <SummaryCard label={t("pos.netSales")} value={money(report.totals.netCents)} />
      </div>

      {report.totals.uncostedUnits > 0 ? (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          {t("pos.profitNote", { count: report.totals.uncostedUnits })}
        </p>
      ) : null}

      {report.totals.salesCount === 0 && report.totals.expensesCents === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={<Receipt className="size-5" aria-hidden="true" />}
            title={t("pos.reportEmpty")}
            description={t("pos.reportEmptyBody")}
          />
        </div>
      ) : (
        <div className="mt-5">
          <ReportTable
            report={report}
            days={days}
            labels={{
              day: t("pos.day"),
              sales: t("pos.salesToday"),
              gross: t("pos.grossSales"),
              cost: t("pos.costOfGoods"),
              profit: t("pos.profit"),
              cash: t("pos.cash"),
              mobile: t("pos.mobileShort"),
              card: t("pos.card"),
              other: t("pos.other"),
              expenses: t("pos.expensesToday"),
              net: t("pos.netSales"),
              total: t("pos.totals"),
            }}
            dayLabel={dayLabel}
            money={amount}
          />
        </div>
      )}

      <section className="mt-6">
        <h2 className="font-display text-base font-semibold tracking-[-0.02em]">
          {t("pos.closedSessions")}
        </h2>

        {report.sessions.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{t("pos.noClosedSessions")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {report.sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-surface p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{session.registerName}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {session.closedAt
                      ? t("pos.sessionWindow", {
                          opened: openedLabel(session.openedAt, session.closedAt),
                          closed: clock(session.closedAt),
                        })
                      : ""}
                    {session.openedByName ? ` · ${session.openedByName}` : ""}
                  </p>
                </div>

                <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">{t("pos.expectedCash")}</dt>
                    <dd className="font-mono tabular-nums">{money(session.expectedCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("pos.countedCash")}</dt>
                    <dd className="font-mono tabular-nums">{money(session.countedCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("pos.differenceLabel")}</dt>
                    <dd
                      className={cn(
                        "font-mono font-medium tabular-nums",
                        session.differenceCents === 0 ? "text-accent" : "text-destructive",
                      )}
                    >
                      {session.differenceCents === 0
                        ? t("pos.balancedLabel")
                        : `${session.differenceCents > 0 ? "+" : "−"}${money(
                            Math.abs(session.differenceCents),
                          )}`}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-semibold tabular-nums sm:text-lg">{value}</p>
    </div>
  );
}

function ReportTable({
  report,
  days,
  labels,
  dayLabel,
  money,
}: {
  report: PosReport;
  days: ReportRange;
  labels: Record<
    | "day"
    | "sales"
    | "gross"
    | "cost"
    | "profit"
    | "cash"
    | "mobile"
    | "card"
    | "other"
    | "expenses"
    | "net"
    | "total",
    string
  >;
  dayLabel: (date: Date) => string;
  money: (cents: number) => string;
}) {
  return (
    <>
      {/* Phones get stacked cards; the table below is for wider screens. */}
      <ul className="space-y-2 sm:hidden">
        {report.days
          .filter((day) => day.salesCount > 0 || day.expensesCents > 0)
          .map((day) => (
            <li key={day.key} className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-semibold">{dayLabel(day.date)}</p>
                <p className="font-mono text-sm font-medium tabular-nums">{money(day.netCents)}</p>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <Row label={labels.sales} value={String(day.salesCount)} />
                <Row label={labels.gross} value={money(day.grossCents)} />
                <Row label={labels.cost} value={money(day.costCents)} />
                <Row label={labels.profit} value={money(day.profitCents)} />
                <Row label={labels.cash} value={money(day.cashCents)} />
                <Row label={labels.expenses} value={money(day.expensesCents)} />
              </dl>
            </li>
          ))}
        <li className="rounded-xl border border-border bg-surface-muted p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase">{labels.total}</p>
            <p className="font-mono text-sm font-semibold tabular-nums">
              {money(report.totals.netCents)}
            </p>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <Row label={labels.sales} value={String(report.totals.salesCount)} />
            <Row label={labels.gross} value={money(report.totals.grossCents)} />
            <Row label={labels.cost} value={money(report.totals.costCents)} />
            <Row label={labels.profit} value={money(report.totals.profitCents)} />
            <Row label={labels.cash} value={money(report.totals.cashCents)} />
            <Row label={labels.expenses} value={money(report.totals.expensesCents)} />
          </dl>
        </li>
      </ul>

      <div className="scroll-x hidden rounded-xl border border-border bg-surface sm:block">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">{`${labels.gross} · ${days}`}</caption>
          <thead>
            <tr className="border-b border-border text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              <th scope="col" className="px-3 py-2.5 text-left font-medium">
                {labels.day}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.sales}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.gross}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.cost}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.profit}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.cash}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.mobile}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.card}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.other}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.expenses}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {labels.net}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.days.map((day) => (
              <tr key={day.key} className={cn(day.salesCount === 0 && "text-muted-foreground")}>
                <th scope="row" className="px-3 py-2 text-left text-xs font-medium">
                  {dayLabel(day.date)}
                </th>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {day.salesCount}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.grossCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.costCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.profitCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.cashCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.mobileCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.cardCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.otherCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {money(day.expensesCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums">
                  {money(day.netCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface-muted font-medium">
              <th scope="row" className="px-3 py-2.5 text-left text-xs uppercase">
                {labels.total}
              </th>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {report.totals.salesCount}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.grossCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.costCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.profitCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.cashCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.mobileCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.cardCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.otherCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.expensesCents)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {money(report.totals.netCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div role="status" aria-label="Loading the retail report">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-5 h-72 w-full rounded-xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
