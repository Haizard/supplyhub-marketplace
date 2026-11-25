export interface AnalyticsAgreement {
  id: string;
  cashPriceMinor: number;
  depositAmountMinor: number;
  outstandingMinor: number;
  status: string;
  createdAt: Date;
  buyerUserId: string;
}

export interface AnalyticsPayment {
  id: string;
  agreementId: string;
  amountMinor: number;
  paidAt: Date | null;
  status: string;
}

export interface AnalyticsSchedule {
  dueDate: Date;
  status: string;
}

export interface InstallmentReport {
  agreementCount: number;
  totalSalesMinor: number;
  depositsCollectedMinor: number;
  outstandingMinor: number;
  collectedThisMonthMinor: number;
  upcomingCount: number;
  overdueCount: number;
  completedCount: number;
  defaultedCount: number;
  activeCount: number;
  monthlyRevenue: { month: string; amountMinor: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure report builder. Money stays in integer minor units end to end. */
export function buildInstallmentReport(
  input: {
    agreements: AnalyticsAgreement[];
    payments: AnalyticsPayment[];
    schedules: AnalyticsSchedule[];
  },
  now = new Date(),
): InstallmentReport {
  const verified = input.payments.filter((payment) => payment.status === "VERIFIED");
  const paidAgreements = new Set(verified.map((payment) => payment.agreementId));

  const monthKey = (value: Date) => value.toISOString().slice(0, 7);
  const currentMonth = monthKey(now);
  const byMonth = new Map<string, number>();
  for (const payment of verified) {
    if (!payment.paidAt) continue;
    const key = monthKey(payment.paidAt);
    byMonth.set(key, (byMonth.get(key) ?? 0) + payment.amountMinor);
  }

  const horizon = now.getTime() + 30 * DAY_MS;
  return {
    agreementCount: input.agreements.length,
    totalSalesMinor: input.agreements.reduce((sum, agreement) => sum + agreement.cashPriceMinor, 0),
    depositsCollectedMinor: input.agreements.reduce(
      (sum, agreement) =>
        paidAgreements.has(agreement.id) ? sum + agreement.depositAmountMinor : sum,
      0,
    ),
    outstandingMinor: input.agreements.reduce(
      (sum, agreement) => sum + agreement.outstandingMinor,
      0,
    ),
    collectedThisMonthMinor: verified.reduce(
      (sum, payment) =>
        payment.paidAt && monthKey(payment.paidAt) === currentMonth
          ? sum + payment.amountMinor
          : sum,
      0,
    ),
    upcomingCount: input.schedules.filter(
      (entry) =>
        entry.status === "PENDING" &&
        entry.dueDate.getTime() >= now.getTime() &&
        entry.dueDate.getTime() <= horizon,
    ).length,
    overdueCount: input.schedules.filter((entry) => entry.status === "OVERDUE").length,
    completedCount: input.agreements.filter((entry) => entry.status === "COMPLETED").length,
    defaultedCount: input.agreements.filter((entry) => entry.status === "DEFAULTED").length,
    activeCount: input.agreements.filter((entry) =>
      ["ACTIVE", "OVERDUE", "PENDING_DEPOSIT"].includes(entry.status),
    ).length,
    monthlyRevenue: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amountMinor]) => ({ month, amountMinor })),
  };
}
