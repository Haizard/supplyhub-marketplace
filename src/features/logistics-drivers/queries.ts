import "server-only";

import type { AssignmentStatus, DriverMembershipStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface DriverMembershipView {
  id: string;
  driverId: string;
  driverName: string;
  phone: string;
  licenseNumber: string;
  status: DriverMembershipStatus;
  joinedAt: string;
  endedAt: string | null;
  activeVehicles: number;
  shifts: number;
}

export interface DriverScheduleView {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface DriverAssignmentView {
  id: string;
  vehicleId: string;
  plate: string;
  vehicleType: string;
  status: AssignmentStatus;
  assignedAt: string;
  endedAt: string | null;
}

export interface DriverEmploymentView {
  type: string;
  mode: string;
  amount: string | null;
  rateBps: number | null;
  startDate: string;
  endDate: string | null;
  notes: string;
}

export interface DriverDetailView {
  membershipId: string;
  companyId: string;
  driverId: string;
  driverName: string;
  status: DriverMembershipStatus;
  employment: DriverEmploymentView | null;
  schedules: DriverScheduleView[];
  assignments: DriverAssignmentView[];
}

export async function listDriverMemberships(companyId: string): Promise<DriverMembershipView[]> {
  const rows = await getDatabase().driverCompanyMembership.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { joinedAt: "desc" }],
    select: {
      id: true,
      driverId: true,
      status: true,
      joinedAt: true,
      endedAt: true,
      driver: {
        select: { fullName: true, phone: true, licenseNumber: true },
      },
      _count: {
        select: {
          schedules: true,
          assignments: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    driverId: row.driverId,
    driverName: row.driver.fullName,
    phone: row.driver.phone ?? "",
    licenseNumber: row.driver.licenseNumber ?? "",
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    activeVehicles: row._count.assignments,
    shifts: row._count.schedules,
  }));
}

export async function getDriverDetail(
  membershipId: string,
  companyId: string,
): Promise<DriverDetailView | null> {
  const membership = await getDatabase().driverCompanyMembership.findFirst({
    where: { id: membershipId, companyId },
    select: {
      id: true,
      companyId: true,
      driverId: true,
      status: true,
      driver: { select: { fullName: true } },
      employment: {
        select: {
          type: true,
          mode: true,
          amount: true,
          rateBps: true,
          startDate: true,
          endDate: true,
          notes: true,
        },
      },
      schedules: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, isAvailable: true },
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          assignedAt: true,
          endedAt: true,
          vehicle: { select: { plate: true, type: true } },
        },
      },
    },
  });
  if (!membership) return null;

  return {
    membershipId: membership.id,
    companyId: membership.companyId,
    driverId: membership.driverId,
    driverName: membership.driver.fullName,
    status: membership.status,
    employment: membership.employment
      ? {
          type: membership.employment.type,
          mode: membership.employment.mode,
          amount: membership.employment.amount?.toString() ?? null,
          rateBps: membership.employment.rateBps,
          startDate: membership.employment.startDate.toISOString(),
          endDate: membership.employment.endDate?.toISOString() ?? null,
          notes: membership.employment.notes ?? "",
        }
      : null,
    schedules: membership.schedules.map((row) => ({
      id: row.id,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      isAvailable: row.isAvailable,
    })),
    assignments: membership.assignments.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      plate: row.vehicle.plate,
      vehicleType: row.vehicle.type,
      status: row.status,
      assignedAt: row.assignedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
    })),
  };
}

/** Memberships visible to a platform user through their own driver profile. */
export async function listActorDriverMemberships(userId: string) {
  const profile = await getDatabase().driverProfile.findUnique({
    where: { userId },
    select: { id: true, fullName: true, status: true },
  });
  if (!profile) return [];
  const memberships = await getDatabase().driverCompanyMembership.findMany({
    where: { driverId: profile.id },
    orderBy: { joinedAt: "desc" },
    select: {
      id: true,
      companyId: true,
      status: true,
      joinedAt: true,
      company: { select: { name: true } },
      assignments: {
        where: { status: "ACTIVE" },
        select: { id: true, vehicle: { select: { plate: true, type: true } } },
      },
    },
  });
  return memberships.map((row) => ({
    id: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    vehicles: row.assignments.map((assignment) => ({
      plate: assignment.vehicle.plate,
      type: assignment.vehicle.type,
    })),
  }));
}
