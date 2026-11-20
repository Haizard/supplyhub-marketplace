import type { Metadata } from "next";
import { Suspense } from "react";

import { CloseSessionForm, ExpenseForm, OpenSessionForm } from "@/components/pos/pos-forms";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/features/catalog/money";
import { getPosWorkspace } from "@/features/pos/queries";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Point of sale",
  description: "Record counter sales, cash sessions, and daily expenses.",
  robots: { index: false, follow: false },
};

export default function PosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PosSkeleton />}>
      <PosContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PosContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [access, params] = await Promise.all([
    requireStudioAccess("pos.sale.create", "/vendor/pos"),
    searchParams,
  ]);
  const workspace = await getPosWorkspace(access.vendorId);

  const soldParam = params.sold;
  const closedParam = params.closed;
  const justClosed =
    (Array.isArray(closedParam) ? closedParam[0] : closedParam) === "1" && workspace.lastClosed
      ? {
          expected: formatMoney(workspace.lastClosed.expectedCents, workspace.currency),
          counted: formatMoney(workspace.lastClosed.countedCents, workspace.currency),
          difference: formatMoney(
            Math.abs(workspace.lastClosed.differenceCents),
            workspace.currency,
          ),
          balanced: workspace.lastClosed.differenceCents === 0,
          over: workspace.lastClosed.differenceCents > 0,
        }
      : null;
  const canRecordExpenses =
    access.permissions.has("*") || access.permissions.has("finance.expense.create");

  return (
    <PosTerminal
      products={workspace.products}
      locationName={workspace.locationName}
      currency={workspace.currency}
      cashierName={access.actor.name}
      session={
        workspace.session
          ? {
              registerName: workspace.session.registerName,
              openedAt: workspace.session.openedAt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              expectedCashCents: workspace.session.expectedCashCents,
              salesCount: workspace.session.salesCount,
            }
          : null
      }
      today={{
        salesCount: workspace.today.salesCount,
        salesTotal: formatMoney(workspace.today.salesTotalCents, workspace.currency),
        cashTotal: formatMoney(workspace.today.cashTotalCents, workspace.currency),
        expensesTotal: formatMoney(workspace.today.expensesTotalCents, workspace.currency),
      }}
      recentSales={workspace.recentSales.map((sale) => ({
        ...sale,
        total: formatMoney(sale.totalCents, sale.currency),
        time: sale.soldAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      }))}
      forms={{
        open: <OpenSessionForm compact />,
        close: workspace.session ? (
          <CloseSessionForm expectedCashCents={workspace.session.expectedCashCents} />
        ) : null,
        expense: canRecordExpenses ? <ExpenseForm /> : null,
      }}
      canRecordExpenses={canRecordExpenses}
      notices={{
        sold: Array.isArray(soldParam) ? (soldParam[0] ?? null) : (soldParam ?? null),
        closed: justClosed,
      }}
    />
  );
}

function PosSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the point of sale"
      className="rounded-[30px] bg-[#11131d] p-3"
    >
      <Skeleton className="h-9 w-64 rounded-full" />
      <div className="mt-3 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_20.5rem]">
        <Skeleton className="h-[30rem] w-full rounded-[24px]" />
        <Skeleton className="h-[30rem] w-full rounded-[24px]" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
