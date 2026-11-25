const DAY_MS = 24 * 60 * 60 * 1000;

/** A schedule row is overdue only after the seller-configured grace period. */
export function isInstallmentOverdue(dueDate: Date, graceDays: number, now = new Date()): boolean {
  const grace = Number.isFinite(graceDays) && graceDays > 0 ? graceDays : 0;
  return now.getTime() > dueDate.getTime() + grace * DAY_MS;
}

export function upcomingReminderDate(dueDate: Date, daysBefore: number): Date {
  const days = Number.isFinite(daysBefore) && daysBefore > 0 ? daysBefore : 1;
  return new Date(dueDate.getTime() - days * DAY_MS);
}

/** Upcoming reminders are queued only inside the lookahead window and before due. */
export function shouldQueueUpcoming(dueDate: Date, daysBefore: number, now = new Date()): boolean {
  const reminderAt = upcomingReminderDate(dueDate, daysBefore);
  return now.getTime() >= reminderAt.getTime() && now.getTime() < dueDate.getTime();
}

export function formatReceiptAmount(amount: string, currency: string): string {
  return `${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}`;
}
