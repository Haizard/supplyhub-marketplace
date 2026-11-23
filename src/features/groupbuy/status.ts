import type { GroupBuyStatus } from "@/generated/prisma/enums";

/** Forward-only transitions for a group buy campaign. */
export const CAMPAIGN_TRANSITIONS: Readonly<Record<GroupBuyStatus, readonly GroupBuyStatus[]>> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["FUNDED", "CANCELLED", "EXPIRED"],
  FUNDED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  EXPIRED: [],
  CANCELLED: [],
};

function canMove(
  map: Readonly<Record<GroupBuyStatus, readonly GroupBuyStatus[]>>,
  from: GroupBuyStatus,
  to: GroupBuyStatus,
): boolean {
  return map[from].includes(to);
}

export function canTransitionCampaign(from: GroupBuyStatus, to: GroupBuyStatus): boolean {
  return canMove(CAMPAIGN_TRANSITIONS, from, to);
}

export const CAMPAIGN_STATUS_LABELS: Record<GroupBuyStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  FUNDED: "Funded",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
