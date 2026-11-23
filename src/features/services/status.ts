import type { ServiceBookingStatus } from "@/generated/prisma/enums";

/** Forward-only transitions for a service booking. */
export const BOOKING_TRANSITIONS: Readonly<
  Record<ServiceBookingStatus, readonly ServiceBookingStatus[]>
> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionBooking(
  from: ServiceBookingStatus,
  to: ServiceBookingStatus,
): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export const BOOKING_STATUS_LABELS: Record<ServiceBookingStatus, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};
