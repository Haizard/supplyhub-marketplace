export interface AdvancedSchedule {
  dueDate: Date;
  amountMinor: number;
  paidMinor: number;
  paidAt: Date | null;
}

export interface AgingReport {
  currentMinor: number;
  days1To30Minor: number;
  days31To60Minor: number;
  over60Minor: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Receivables aging uses unpaid amounts only; a fully paid row is never overdue. */
export function buildAgingReport(schedules: AdvancedSchedule[], now = new Date()): AgingReport {
  const report: AgingReport = {
    currentMinor: 0,
    days1To30Minor: 0,
    days31To60Minor: 0,
    over60Minor: 0,
  };
  for (const entry of schedules) {
    const unpaid = Math.max(0, entry.amountMinor - entry.paidMinor);
    if (unpaid === 0) continue;
    const daysLate = Math.floor((now.getTime() - entry.dueDate.getTime()) / DAY_MS);
    if (daysLate <= 0) report.currentMinor += unpaid;
    else if (daysLate <= 30) report.days1To30Minor += unpaid;
    else if (daysLate <= 60) report.days31To60Minor += unpaid;
    else report.over60Minor += unpaid;
  }
  return report;
}

export interface CollectionForecast {
  next30Minor: number;
  next60Minor: number;
  next90Minor: number;
}

/** Expected collections by due-date horizon, using unpaid amounts only. */
export function buildCollectionForecast(
  schedules: AdvancedSchedule[],
  now = new Date(),
): CollectionForecast {
  const result: CollectionForecast = { next30Minor: 0, next60Minor: 0, next90Minor: 0 };
  for (const entry of schedules) {
    const unpaid = Math.max(0, entry.amountMinor - entry.paidMinor);
    if (unpaid === 0) continue;
    const offset = entry.dueDate.getTime() - now.getTime();
    if (offset <= 30 * DAY_MS) result.next30Minor += unpaid;
    if (offset <= 60 * DAY_MS) result.next60Minor += unpaid;
    if (offset <= 90 * DAY_MS) result.next90Minor += unpaid;
  }
  return result;
}

export interface AdvancedInstallmentReport {
  aging: AgingReport;
  forecast: CollectionForecast;
  kpis: RepaymentKpis;
}

export function buildAdvancedInstallmentReport(
  schedules: AdvancedSchedule[],
  agreementStatuses: string[],
  now = new Date(),
): AdvancedInstallmentReport {
  return {
    aging: buildAgingReport(schedules, now),
    forecast: buildCollectionForecast(schedules, now),
    kpis: buildRepaymentKpis(schedules, agreementStatuses),
  };
}

export interface RepaymentKpis {
  settledCount: number;
  onTimeCount: number;
  onTimeRate: number;
  averageDaysLate: number;
  completionRate: number;
  defaultRate: number;
}

export function buildRepaymentKpis(
  schedules: AdvancedSchedule[],
  agreementStatuses: string[],
): RepaymentKpis {
  const settled = schedules.filter((entry) => entry.paidAt && entry.paidMinor >= entry.amountMinor);
  const lateDays = settled
    .map((entry) =>
      Math.max(0, Math.floor((entry.paidAt!.getTime() - entry.dueDate.getTime()) / DAY_MS)),
    )
    .filter((days) => days > 0);
  const onTimeCount = settled.length - lateDays.length;
  const total = agreementStatuses.length;
  return {
    settledCount: settled.length,
    onTimeCount,
    onTimeRate: settled.length === 0 ? 0 : Math.round((onTimeCount / settled.length) * 1000) / 10,
    averageDaysLate:
      lateDays.length === 0
        ? 0
        : Math.round((lateDays.reduce((a, b) => a + b, 0) / lateDays.length) * 10) / 10,
    completionRate:
      total === 0
        ? 0
        : Math.round((agreementStatuses.filter((s) => s === "COMPLETED").length / total) * 1000) /
          10,
    defaultRate:
      total === 0
        ? 0
        : Math.round((agreementStatuses.filter((s) => s === "DEFAULTED").length / total) * 1000) /
          10,
  };
}
