import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  CompensationForm,
  EarningForm,
  EarningStatusForm,
  ExpenseForm,
  PayoutForm,
  PayoutStatusForm,
  ReconcileSettlementForm,
  SettlementForm,
} from "@/components/logistics/finance-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/logistics/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import {
  listDriverMembershipsForFinance,
  listEarnings,
  listExpenses,
  listPayouts,
  listSettlements,
  listVehiclesForFinance,
} from "@/features/logistics-finance/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company finance",
  robots: { index: false, follow: false },
};

export default function CompanyFinancePage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyFinanceContent params={params} />
    </Suspense>
  );
}

async function CompanyFinanceContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  const access = await requireLogisticsAccess(
    "logistics.finance.read",
    companyId,
    `/logistics/${companyId}/finance`,
  );
  const [company, drivers, earnings, payouts, expenses, settlements, vehicles] = await Promise.all([
    getLogisticsCompany(companyId),
    listDriverMembershipsForFinance(companyId),
    listEarnings(companyId),
    listPayouts(companyId),
    listExpenses(companyId),
    listSettlements(companyId),
    listVehiclesForFinance(companyId),
  ]);
  if (!company) notFound();
  const canApprove =
    access.permissions.has("*") || access.permissions.has("logistics.finance.approve");

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Finance"
        description="Company-to-driver and company-to-merchant money stays separate from the platform ledger."
      />

      {canApprove ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Driver compensation rules</h2>
          <div className="mt-4">
            <CompensationForm companyId={companyId} drivers={drivers} />
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Driver earnings</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {earnings.map((earning) => (
            <li
              key={earning.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2"
            >
              <span>
                {earning.driverName} · {earning.amount} {earning.currency} · {earning.basis}
              </span>
              <div className="flex items-center gap-3">
                <Badge tone={earning.status === "APPROVED" ? "success" : "neutral"}>
                  {earning.status}
                </Badge>
                {canApprove && earning.status === "PENDING" ? (
                  <EarningStatusForm companyId={companyId} earningId={earning.id} />
                ) : null}
              </div>
            </li>
          ))}
          {earnings.length === 0 ? (
            <li className="text-muted-foreground">No earnings recorded.</li>
          ) : null}
        </ul>
        {canApprove ? (
          <div className="mt-4 border-t border-border pt-4">
            <EarningForm companyId={companyId} drivers={drivers} />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Driver payouts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {payouts.map((payout) => (
            <li
              key={payout.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2"
            >
              <span>
                {payout.payoutNumber} · {payout.driverName} · {payout.amount} {payout.currency}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={payout.status === "PAID" ? "success" : "neutral"}>
                  {payout.status}
                </Badge>
                {canApprove ? (
                  <PayoutStatusForm
                    companyId={companyId}
                    payoutId={payout.id}
                    status={payout.status}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {payouts.length === 0 ? <li className="text-muted-foreground">No payouts yet.</li> : null}
        </ul>
        {canApprove ? (
          <div className="mt-4 border-t border-border pt-4">
            <PayoutForm companyId={companyId} drivers={drivers} />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Operating expenses</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {expenses.map((expense) => (
            <li key={expense.id}>
              {expense.category} · {expense.amount} {expense.currency} ·{" "}
              {new Date(expense.occurredAt).toLocaleDateString()}
              {expense.reference ? ` · ${expense.reference}` : ""}
            </li>
          ))}
          {expenses.length === 0 ? (
            <li className="text-muted-foreground">No expenses recorded.</li>
          ) : null}
        </ul>
        <div className="mt-4 border-t border-border pt-4">
          <ExpenseForm companyId={companyId} vehicles={vehicles} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Settlements</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {settlements.map((settlement) => (
            <li
              key={settlement.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2"
            >
              <span>
                {settlement.settlementNumber} · revenue {settlement.revenue} · net {settlement.net}
              </span>
              <div className="flex items-center gap-3">
                <Badge tone={settlement.status === "RECONCILED" ? "success" : "neutral"}>
                  {settlement.status}
                </Badge>
                {canApprove && settlement.status === "DRAFT" ? (
                  <ReconcileSettlementForm companyId={companyId} settlementId={settlement.id} />
                ) : null}
              </div>
            </li>
          ))}
          {settlements.length === 0 ? (
            <li className="text-muted-foreground">No settlements yet.</li>
          ) : null}
        </ul>
        {canApprove ? (
          <div className="mt-4 border-t border-border pt-4">
            <SettlementForm companyId={companyId} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
