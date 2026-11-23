import type { BusinessSubscriptionStatus } from "@/generated/prisma/enums";

export const SUBSCRIPTION_TRANSITIONS: Record<
  BusinessSubscriptionStatus,
  readonly BusinessSubscriptionStatus[]
> = {
  TRIALING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAST_DUE", "CANCELLED"],
  PAST_DUE: ["ACTIVE", "CANCELLED"],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionSubscription(
  from: BusinessSubscriptionStatus,
  to: BusinessSubscriptionStatus,
): boolean {
  return SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

export function billableSeats(seats: number, includedSeats: number): number {
  return Math.max(0, Math.floor(seats) - Math.max(0, Math.floor(includedSeats)));
}

/** Per-seat monthly price × chargeable seats, returned as a decimal string. */
export function subscriptionMonthlyTotal(
  priceMonthly: { toString(): string } | number | string,
  seats: number,
  includedSeats: number,
): string {
  const price = Number(typeof priceMonthly === "object" ? priceMonthly.toString() : priceMonthly);
  if (!Number.isFinite(price) || price <= 0) return "0.00";
  return (Math.round(price * billableSeats(seats, includedSeats) * 100) / 100).toFixed(2);
}

/** One calendar month from `from`, clamping the day for short months. */
export function nextBillingPeriod(from: Date): { start: Date; end: Date } {
  const start = new Date(from.getTime());
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), daysInTargetMonth);

  return {
    start,
    end: new Date(
      Date.UTC(
        year,
        month + 1,
        day,
        start.getUTCHours(),
        start.getUTCMinutes(),
        start.getUTCSeconds(),
        start.getUTCMilliseconds(),
      ),
    ),
  };
}
