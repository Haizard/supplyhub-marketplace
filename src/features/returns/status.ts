import type { ReturnReason, ReturnStatus } from "@/generated/prisma/enums";

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Declined",
  COMPLETED: "Completed",
};

export const RETURN_STATUS_TONES: Record<
  ReturnStatus,
  "neutral" | "accent" | "clay" | "success" | "danger"
> = {
  REQUESTED: "clay",
  APPROVED: "accent",
  REJECTED: "danger",
  COMPLETED: "success",
};

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: "Arrived damaged",
  NOT_AS_DESCRIBED: "Not as described",
  WRONG_ITEM: "Wrong object",
  CHANGED_MIND: "Changed my mind",
  OTHER: "Something else",
};
