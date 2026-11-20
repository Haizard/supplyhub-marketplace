import type { DeliveryJobStatus } from "@/generated/prisma/enums";

/**
 * Allowed transitions for a delivery job. `PENDING` lives on the request; a
 * job starts at ASSIGNED. There is deliberately no path back to an earlier
 * state — every move is forward and recorded in delivery_status_history.
 */
export const JOB_TRANSITIONS: Readonly<Record<DeliveryJobStatus, readonly DeliveryJobStatus[]>> = {
  ASSIGNED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["TO_PICKUP", "CANCELLED"],
  TO_PICKUP: ["AT_PICKUP", "CANCELLED"],
  AT_PICKUP: ["TRANSIT", "CANCELLED"],
  TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionJob(from: DeliveryJobStatus, to: DeliveryJobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

/** The actor role allowed to drive each transition. */
export type JobActor = "agent" | "requester" | "admin";

export function canActorTransition(
  from: DeliveryJobStatus,
  to: DeliveryJobStatus,
  actor: JobActor,
): boolean {
  if (!canTransitionJob(from, to)) return false;
  if (to === "CANCELLED") return actor === "requester" || actor === "admin";
  return actor === "agent" || actor === "admin";
}

export const JOB_STATUS_LABELS: Record<DeliveryJobStatus, string> = {
  ASSIGNED: "Courier assigned",
  ACCEPTED: "Courier accepted",
  TO_PICKUP: "Heading to pickup",
  AT_PICKUP: "At the studio",
  TRANSIT: "On the way to you",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Ordered timeline shown to buyers, excluding the terminal cancelled state. */
export const BUYER_TIMELINE: readonly DeliveryJobStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "TO_PICKUP",
  "AT_PICKUP",
  "TRANSIT",
  "DELIVERED",
];
