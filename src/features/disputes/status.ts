import type { DisputeStatus } from "@/generated/prisma/enums";

/** Forward-only transitions for a buyer dispute. */
export const DISPUTE_TRANSITIONS: Readonly<Record<DisputeStatus, readonly DisputeStatus[]>> = {
  OPEN: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
};

export function canTransitionDispute(from: DisputeStatus, to: DisputeStatus): boolean {
  return DISPUTE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export function isDisputeClosed(status: DisputeStatus): boolean {
  return status === "RESOLVED" || status === "REJECTED";
}
