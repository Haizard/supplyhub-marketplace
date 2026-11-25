export interface AllocationScheduleEntry {
  id: string;
  sequence: number;
  amountMinor: number;
  paidMinor: number;
  status: string;
}

export interface Allocation {
  scheduleId: string;
  amountMinor: number;
}

export interface ScheduleUpdate {
  scheduleId: string;
  paidMinor: number;
  status: "PENDING" | "PAID" | "OVERDUE";
}

export type AllocationPlan =
  | { ok: true; allocations: Allocation[]; updates: ScheduleUpdate[]; remainingMinor: number }
  | { ok: false; reason: string };

export const toMinor = (value: number): number => Math.round(value * 100);
export const toMajor = (value: number): number => Math.round(value) / 100;

/**
 * Allocates a verified payment across open instalments in due order. Partial
 * payments are supported; an ineligible overpayment is rejected before any
 * provider money is accepted.
 */
export function planPaymentAllocation(
  amountMinor: number,
  entries: AllocationScheduleEntry[],
  allowAdvance: boolean,
): AllocationPlan {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, reason: "Payment amount must be a positive amount." };
  }
  const open = [...entries].sort((a, b) => a.sequence - b.sequence);
  const capacity = open.reduce(
    (sum, entry) =>
      entry.status === "PAID" || entry.status === "WAIVED"
        ? sum
        : sum + Math.max(0, entry.amountMinor - entry.paidMinor),
    0,
  );
  if (amountMinor > capacity && !allowAdvance) {
    return {
      ok: false,
      reason: "Payment exceeds the outstanding balance and advance payments are not enabled.",
    };
  }

  let remaining = amountMinor;
  const allocations: Allocation[] = [];
  const updates: ScheduleUpdate[] = [];
  for (const entry of open) {
    if (remaining <= 0) break;
    if (entry.status === "PAID" || entry.status === "WAIVED") continue;
    const available = Math.max(0, entry.amountMinor - entry.paidMinor);
    if (available === 0) continue;
    const applied = Math.min(available, remaining);
    allocations.push({ scheduleId: entry.id, amountMinor: applied });
    remaining -= applied;
    const paidMinor = entry.paidMinor + applied;
    updates.push({
      scheduleId: entry.id,
      paidMinor,
      status:
        paidMinor >= entry.amountMinor
          ? "PAID"
          : entry.status === "OVERDUE"
            ? "OVERDUE"
            : "PENDING",
    });
  }

  return { ok: true, allocations, updates, remainingMinor: remaining };
}

/** Refunds reverse allocations in reverse order, never below zero paid. */
export function planRefund(
  amountMinor: number,
  entries: { scheduleId: string; paidMinor: number }[],
): { reductions: Allocation[]; remainingMinor: number } {
  let remaining = amountMinor;
  const reductions: Allocation[] = [];
  for (const entry of [...entries].reverse()) {
    if (remaining <= 0) break;
    const reversible = Math.min(entry.paidMinor, remaining);
    if (reversible <= 0) continue;
    reductions.push({ scheduleId: entry.scheduleId, amountMinor: reversible });
    remaining -= reversible;
  }
  return { reductions, remainingMinor: remaining };
}
