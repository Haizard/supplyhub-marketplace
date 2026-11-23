import type { VehicleStatus } from "@/generated/prisma/enums";

export const VEHICLE_TRANSITIONS: Readonly<Record<VehicleStatus, readonly VehicleStatus[]>> = {
  ACTIVE: ["MAINTENANCE", "INACTIVE", "RETIRED"],
  MAINTENANCE: ["ACTIVE", "RETIRED"],
  INACTIVE: ["ACTIVE", "RETIRED"],
  RETIRED: [],
};

export function canTransitionVehicle(from: VehicleStatus, to: VehicleStatus): boolean {
  return VEHICLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  ACTIVE: "Active",
  MAINTENANCE: "Maintenance",
  INACTIVE: "Inactive",
  RETIRED: "Retired",
};
