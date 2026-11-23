import type { DriverMembershipStatus } from "@/generated/prisma/enums";

export const MEMBERSHIP_TRANSITIONS: Readonly<
  Record<DriverMembershipStatus, readonly DriverMembershipStatus[]>
> = {
  ACTIVE: ["SUSPENDED", "ENDED"],
  SUSPENDED: ["ACTIVE", "ENDED"],
  ENDED: [],
};

export function canTransitionMembership(
  from: DriverMembershipStatus,
  to: DriverMembershipStatus,
): boolean {
  return MEMBERSHIP_TRANSITIONS[from]?.includes(to) ?? false;
}

export const MEMBERSHIP_STATUS_LABELS: Record<DriverMembershipStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ENDED: "Ended",
};
