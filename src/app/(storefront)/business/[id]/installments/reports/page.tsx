import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  ReconcileInstallmentsForm,
  ResolveInstallmentDisputeForm,
} from "@/components/installments/report-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authorizeInstallmentSeller } from "@/features/installments/access";
import { formatReceiptAmount } from "@/features/installments/overdue-rules";
import {
  getAdvancedInstallmentReport,
  getInstallmentReport,
  listInstallmentDisputes,
  listInstallmentReconciliationFindings,
  listInstallmentReconciliationRuns,
  searchInstallmentCustomers,
} from "@/features/installments/report-queries";
import { getInstallmentSettings } from "@/features/installments/queries";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Installment reports",
  robots: { index: false, follow: false },
};

export default async function InstallmentReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const access = await authorizeInstallmentSeller(id, `/business/${id}/installments/reports`);
  if ("error" in access) notFound();

  const query = await searchParams;
  const emailParam = Array.isArray(query.email) ? query.email[0] : query.email;
  const email = emailParam?.trim() ?? "";

  const [report, advanced, settings, disputes, runs, customers] = await Promise.all([
    getInstallmentReport(id),
    getAdvancedInstallmentReport(id),
    getInstallmentSettings(id),
    listInstallmentDisputes(id),
    listInstallmentReconciliationRuns(id),
    email ? searchInstallmentCustomers(id, email) : Promise.resolve([]),
  ]);
  const currency = settings?.currency ?? "TZS";
  const money = (minor: number) => formatReceiptAmount((minor / 100).toFixed(2), currency);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Installment reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Receivables, collections and reconciliation for this business. Amounts are derived from
          stored agreements and verified payments only.
        </p>
        <Link href={`/business/${id}/installments`} className="text-xs text-accent underline">
          Back to installments
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Agreements", String(report.agreementCount)],
          ["Total installment sales", money(report.totalSalesMinor)],
          ["Deposits collected", money(report.depositsCollectedMinor)],
          ["Outstanding balances", money(report.outstandingMinor)],
          ["Collected this month", money(report.collectedThisMonthMinor)],
          ["Upcoming instalments (30 days)", String(report.upcomingCount)],
          ["Overdue instalments", String(report.overdueCount)],
          ["Active agreements", String(report.activeCount)],
          ["Completed / defaulted", `${report.completedCount} / ${report.defaultedCount}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-medium">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Receivables aging</h2>
        <ul className="mt-3 space-y-1 text-xs">
          <li>Current: {money(advanced.aging.currentMinor)}</li>
          <li>1–30 days: {money(advanced.aging.days1To30Minor)}</li>
          <li>31–60 days: {money(advanced.aging.days31To60Minor)}</li>
          <li>Over 60 days: {money(advanced.aging.over60Minor)}</li>
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6 text-sm">
          <h2 className="font-display text-lg font-medium">Collection forecast</h2>
          <ul className="mt-3 space-y-1 text-xs">
            <li>Next 30 days: {money(advanced.forecast.next30Minor)}</li>
            <li>Next 60 days: {money(advanced.forecast.next60Minor)}</li>
            <li>Next 90 days: {money(advanced.forecast.next90Minor)}</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 text-sm">
          <h2 className="font-display text-lg font-medium">Repayment KPIs</h2>
          <ul className="mt-3 space-y-1 text-xs">
            <li>
              On-time rate: {advanced.kpis.onTimeRate}% ({advanced.kpis.onTimeCount}/
              {advanced.kpis.settledCount})
            </li>
            <li>Average days late: {advanced.kpis.averageDaysLate}</li>
            <li>Completion rate: {advanced.kpis.completionRate}%</li>
            <li>Default rate: {advanced.kpis.defaultRate}%</li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Monthly collections</h2>
        <ul className="mt-3 space-y-1 text-xs">
          {report.monthlyRevenue.map((row) => (
            <li key={row.month}>
              {row.month} · {money(row.amountMinor)}
            </li>
          ))}
          {report.monthlyRevenue.length === 0 ? (
            <li className="text-muted-foreground">No verified collections yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Customer history</h2>
        <form method="GET" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="businessId" value={id} />
          <Input
            name="email"
            defaultValue={email}
            placeholder="Search buyer email"
            className="h-9 w-64"
          />
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
        <ul className="mt-3 space-y-1 text-xs">
          {customers.map((customer) => (
            <li key={customer.email}>
              {customer.email} · {customer.agreementCount} agreement(s) · outstanding{" "}
              {money(customer.outstandingMinor)} · paid {money(customer.paidMinor)}
            </li>
          ))}
          {email && customers.length === 0 ? (
            <li className="text-muted-foreground">No agreements for that email.</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-6 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Reconciliation</h2>
          <ReconcileInstallmentsForm businessId={id} />
        </div>
        {runs.length === 0 ? (
          <p className="text-muted-foreground">No reconciliation runs yet.</p>
        ) : (
          <ul className="space-y-3">
            {runs.map((run) => (
              <li key={run.id} className="rounded-md border border-border/50 p-3 text-xs">
                <p>
                  {run.runNumber} · {run.status} · checked {run.checkedCount} · findings{" "}
                  {run.findingCount} · {new Date(run.createdAt).toLocaleString()}
                </p>
                <Findings runId={run.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-medium">Disputes</h2>
        {disputes.length === 0 ? (
          <p className="text-muted-foreground">No disputes recorded.</p>
        ) : (
          <ul className="space-y-3">
            {disputes.map((dispute) => (
              <li
                key={dispute.id}
                className="space-y-2 rounded-md border border-border/50 p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {dispute.disputeNumber} · {dispute.agreementNumber} · opened by{" "}
                    {dispute.openedByRole}
                  </span>
                  <Badge tone={dispute.status === "RESOLVED" ? "success" : "neutral"}>
                    {dispute.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{dispute.reason}</p>
                {dispute.resolution ? <p>Resolution: {dispute.resolution}</p> : null}
                {["OPEN", "UNDER_REVIEW"].includes(dispute.status) ? (
                  <ResolveInstallmentDisputeForm businessId={id} disputeId={dispute.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

async function Findings({ runId }: { runId: string }) {
  const findings = await listInstallmentReconciliationFindings(runId);
  if (findings.length === 0) return <p className="mt-1 text-muted-foreground">No findings.</p>;
  return (
    <ul className="mt-1 space-y-1 text-muted-foreground">
      {findings.map((finding, index) => (
        <li key={`${index}-${finding}`}>{finding}</li>
      ))}
    </ul>
  );
}
