import type { ClientRelationshipStatus, LogisticsClientStatus } from "@/generated/prisma/enums";

export const CLIENT_TRANSITIONS: Readonly<
  Record<LogisticsClientStatus, readonly LogisticsClientStatus[]>
> = {
  PROSPECT: ["ACTIVE", "SUSPENDED"],
  ACTIVE: ["SUSPENDED", "ENDED"],
  SUSPENDED: ["ACTIVE", "ENDED"],
  ENDED: [],
};

export function canTransitionClient(
  from: LogisticsClientStatus,
  to: LogisticsClientStatus,
): boolean {
  return CLIENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const RELATIONSHIP_TRANSITIONS: Readonly<
  Record<ClientRelationshipStatus, readonly ClientRelationshipStatus[]>
> = {
  PENDING: ["ACTIVE", "SUSPENDED", "ENDED"],
  ACTIVE: ["SUSPENDED", "ENDED"],
  SUSPENDED: ["ACTIVE", "ENDED"],
  ENDED: [],
};

export function canTransitionRelationship(
  from: ClientRelationshipStatus,
  to: ClientRelationshipStatus,
): boolean {
  return RELATIONSHIP_TRANSITIONS[from]?.includes(to) ?? false;
}

export const CLIENT_STATUS_LABELS: Record<LogisticsClientStatus, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ENDED: "Ended",
};

export const RELATIONSHIP_STATUS_LABELS: Record<ClientRelationshipStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ENDED: "Ended",
};
