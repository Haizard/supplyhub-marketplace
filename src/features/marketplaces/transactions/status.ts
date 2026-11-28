import type { MarketplaceTransactionStatus } from "@/generated/prisma/enums";

export type TransactionTimelineSource = "TRANSACTION" | "LOGISTICS" | "SERVICE";

export const TRANSACTION_STATUS_TONES: Record<
  MarketplaceTransactionStatus,
  "neutral" | "accent" | "success" | "danger"
> = {
  OPEN: "neutral",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
};

/**
 * The stored status only records the terminal states. A transaction is
 * "in progress" as soon as a courier holds the job or the studio has confirmed
 * the booking, so that part is derived from the child records instead of being
 * written by five different workspaces.
 */
export function deriveTransactionStatus(input: {
  stored: MarketplaceTransactionStatus;
  jobStatuses: readonly string[];
  bookingStatus: string | null;
}): MarketplaceTransactionStatus {
  if (input.stored === "COMPLETED" || input.stored === "CANCELLED") return input.stored;
  const jobRunning = input.jobStatuses.some((status) => status !== "CANCELLED");
  const bookingRunning =
    input.bookingStatus === "CONFIRMED" || input.bookingStatus === "IN_PROGRESS";
  return jobRunning || bookingRunning ? "IN_PROGRESS" : "OPEN";
}

/** A job that has been handed to a driver cannot be cancelled by the buyer. */
export function hasRunningJob(statuses: readonly string[]): boolean {
  return statuses.some((status) => status !== "DELIVERED" && status !== "CANCELLED");
}

export function canCancelTransaction(input: {
  status: MarketplaceTransactionStatus;
  jobStatuses: readonly string[];
  bookingStatus: string | null;
}): boolean {
  if (input.status !== "OPEN" && input.status !== "IN_PROGRESS") return false;
  if (hasRunningJob(input.jobStatuses)) return false;
  return !(
    input.bookingStatus === "IN_PROGRESS" ||
    input.bookingStatus === "COMPLETED" ||
    input.bookingStatus === "NO_SHOW"
  );
}

/** Complete only once the delivery arrived and any booked work is finished. */
export function canCompleteTransaction(input: {
  status: MarketplaceTransactionStatus;
  jobStatuses: readonly string[];
  requestStatus: string | null;
  bookingStatus: string | null;
}): boolean {
  if (input.status !== "OPEN" && input.status !== "IN_PROGRESS") return false;
  if (hasRunningJob(input.jobStatuses)) return false;
  const delivered = input.jobStatuses.includes("DELIVERED") || input.requestStatus === "COMPLETED";
  if (!delivered) return false;
  if (!input.bookingStatus) return true;
  return (
    input.bookingStatus === "COMPLETED" ||
    input.bookingStatus === "CANCELLED" ||
    input.bookingStatus === "NO_SHOW"
  );
}

/** One key per timeline entry, shared by the order page and the trail. */
export function timelineLabelKey(source: TransactionTimelineSource, kind: string): string {
  if (source === "LOGISTICS") return `transactions.logistics.${kind}`;
  if (source === "SERVICE") return `transactions.booking.${kind}`;
  return `transactions.events.${kind}`;
}
