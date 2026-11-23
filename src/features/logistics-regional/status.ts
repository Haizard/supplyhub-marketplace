import type { CorridorStatus } from "@/generated/prisma/enums";

export const CORRIDOR_TRANSITIONS: Record<CorridorStatus, CorridorStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["INACTIVE"],
  INACTIVE: ["ACTIVE"],
};

export function canTransitionCorridor(from: CorridorStatus, to: CorridorStatus): boolean {
  return CORRIDOR_TRANSITIONS[from]?.includes(to) ?? false;
}

export const CORRIDOR_STATUS_LABELS: Record<CorridorStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};
