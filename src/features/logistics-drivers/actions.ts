"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import { canTransitionMembership } from "./status";
import {
  assignmentSchema,
  driverProfileSchema,
  employmentSchema,
  membershipStatusSchema,
  scheduleSchema,
} from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

/** Creates a company-independent driver profile plus this company's membership. */
export async function createDriverProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = driverProfileSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    fullName: formValue(formData, "fullName"),
    phone: formValue(formData, "phone"),
    licenseNumber: formValue(formData, "licenseNumber"),
    licenseExpiresAt: formValue(formData, "licenseExpiresAt"),
    userId: formValue(formData, "userId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.driver.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/drivers`,
  );
  const database = getDatabase();

  if (parsed.data.userId) {
    const user = await database.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true },
    });
    if (!user) return fail("No platform account exists with that user ID.");
  }

  try {
    await database.$transaction(async (tx) => {
      const profile = await tx.driverProfile.create({
        data: {
          fullName: parsed.data.fullName,
          phone: parsed.data.phone ?? null,
          licenseNumber: parsed.data.licenseNumber ?? null,
          licenseExpiresAt: parsed.data.licenseExpiresAt ?? null,
          userId: parsed.data.userId ?? null,
        },
        select: { id: true },
      });
      const membership = await tx.driverCompanyMembership.create({
        data: { companyId: access.companyId, driverId: profile.id, status: "ACTIVE" },
        select: { id: true },
      });
      await recordAuditEvent(tx, {
        actorId: access.actorId,
        action: "LOGISTICS_DRIVER_PROFILE_CREATED",
        targetType: "DriverCompanyMembership",
        targetId: membership.id,
        metadata: { companyId: access.companyId, driverId: profile.id },
      });
      await appendOutboxEvent(tx, {
        eventType: "logistics.driver.membership_created",
        aggregateType: "DriverCompanyMembership",
        aggregateId: membership.id,
        payload: { companyId: access.companyId, driverId: profile.id },
      });
    });
  } catch {
    return fail("The driver could not be added.");
  }

  revalidatePath(`/logistics/${access.companyId}/drivers`);
  return ok("Driver added to this company.");
}

export async function setMembershipStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = membershipStatusSchema.safeParse({
    membershipId: formValue(formData, "membershipId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.driver.manage",
    companyId,
    `/logistics/${companyId}/drivers`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const membership = await tx.driverCompanyMembership.findFirst({
      where: { id: parsed.data.membershipId, companyId: access.companyId },
      select: { id: true, status: true },
    });
    if (!membership) return "not-found" as const;
    if (!canTransitionMembership(membership.status, parsed.data.toStatus))
      return "invalid" as const;

    if (parsed.data.toStatus === "ENDED") {
      await tx.driverVehicleAssignment.updateMany({
        where: { membershipId: membership.id, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: new Date() },
      });
    }
    await tx.driverCompanyMembership.update({
      where: { id: membership.id },
      data: {
        status: parsed.data.toStatus,
        endedAt: parsed.data.toStatus === "ENDED" ? new Date() : null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_MEMBERSHIP_CHANGED",
      targetType: "DriverCompanyMembership",
      targetId: membership.id,
      metadata: { companyId: access.companyId, status: parsed.data.toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/drivers`);
  if (result === "not-found") return fail("That membership could not be found.");
  if (result === "invalid") return fail("That membership change is not allowed.");
  return ok("Membership updated.");
}

export async function saveEmploymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = employmentSchema.safeParse({
    membershipId: formValue(formData, "membershipId"),
    type: formValue(formData, "type"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    mode: formValue(formData, "mode"),
    amount: formValue(formData, "amount"),
    rateBps: formValue(formData, "rateBps"),
    notes: formValue(formData, "notes"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.driver.manage",
    companyId,
    `/logistics/${companyId}/drivers`,
  );
  const database = getDatabase();
  const membership = await database.driverCompanyMembership.findFirst({
    where: { id: parsed.data.membershipId, companyId: access.companyId },
    select: { id: true },
  });
  if (!membership) return fail("That membership is not part of this company.");

  await database.$transaction(async (tx) => {
    await tx.driverEmploymentRecord.upsert({
      where: { membershipId: membership.id },
      create: {
        membershipId: membership.id,
        type: parsed.data.type,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate ?? null,
        mode: parsed.data.mode,
        amount: parsed.data.amount !== undefined ? new Prisma.Decimal(parsed.data.amount) : null,
        rateBps: parsed.data.rateBps ?? null,
        notes: parsed.data.notes ?? null,
      },
      update: {
        type: parsed.data.type,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate ?? null,
        mode: parsed.data.mode,
        amount: parsed.data.amount !== undefined ? new Prisma.Decimal(parsed.data.amount) : null,
        rateBps: parsed.data.rateBps ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_EMPLOYMENT_SAVED",
      targetType: "DriverCompanyMembership",
      targetId: membership.id,
      metadata: { companyId: access.companyId, mode: parsed.data.mode },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/drivers/${membership.id}`);
  return ok("Compensation agreement saved.");
}

export async function saveScheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = scheduleSchema.safeParse({
    membershipId: formValue(formData, "membershipId"),
    dayOfWeek: formValue(formData, "dayOfWeek"),
    startTime: formValue(formData, "startTime"),
    endTime: formValue(formData, "endTime"),
    isAvailable: formValue(formData, "isAvailable") || "off",
  });
  if (!parsed.success) return failFields(parsed.error);
  if (parsed.data.endTime <= parsed.data.startTime)
    return fail("End time must be after start time.");

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.driver.manage",
    companyId,
    `/logistics/${companyId}/drivers`,
  );
  const database = getDatabase();
  const membership = await database.driverCompanyMembership.findFirst({
    where: { id: parsed.data.membershipId, companyId: access.companyId },
    select: { id: true },
  });
  if (!membership) return fail("That membership is not part of this company.");

  await database.$transaction(async (tx) => {
    await tx.driverSchedule.create({
      data: {
        membershipId: membership.id,
        dayOfWeek: parsed.data.dayOfWeek,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        isAvailable: parsed.data.isAvailable,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_SCHEDULE_SAVED",
      targetType: "DriverCompanyMembership",
      targetId: membership.id,
      metadata: { companyId: access.companyId, dayOfWeek: parsed.data.dayOfWeek },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/drivers/${membership.id}`);
  return ok("Shift added.");
}

export async function assignVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = assignmentSchema.safeParse({
    membershipId: formValue(formData, "membershipId"),
    vehicleId: formValue(formData, "vehicleId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.driver.manage",
    companyId,
    `/logistics/${companyId}/drivers`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const membership = await tx.driverCompanyMembership.findFirst({
      where: { id: parsed.data.membershipId, companyId: access.companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) return "no-membership" as const;
    const vehicle = await tx.logisticsVehicle.findFirst({
      where: { id: parsed.data.vehicleId, companyId: access.companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!vehicle) return "no-vehicle" as const;

    const vehicleBusy = await tx.driverVehicleAssignment.count({
      where: { vehicleId: vehicle.id, status: "ACTIVE" },
    });
    if (vehicleBusy > 0) return "vehicle-busy" as const;

    await tx.driverVehicleAssignment.updateMany({
      where: { membershipId: membership.id, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: new Date() },
    });
    const assignment = await tx.driverVehicleAssignment.create({
      data: { membershipId: membership.id, vehicleId: vehicle.id, status: "ACTIVE" },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_VEHICLE_ASSIGNED",
      targetType: "DriverVehicleAssignment",
      targetId: assignment.id,
      metadata: { companyId: access.companyId, vehicleId: vehicle.id },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/drivers/${parsed.data.membershipId}`);
  if (result === "no-membership")
    return fail("That active membership is not part of this company.");
  if (result === "no-vehicle") return fail("That vehicle is not active in this company.");
  if (result === "vehicle-busy") return fail("That vehicle is already assigned.");
  return ok("Vehicle assigned.");
}

export async function releaseVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = z.object({ companyId: z.uuid(), assignmentId: z.uuid() }).safeParse({
    companyId: formValue(formData, "companyId"),
    assignmentId: formValue(formData, "assignmentId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.driver.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/drivers`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const assignment = await tx.driverVehicleAssignment.findFirst({
      where: {
        id: parsed.data.assignmentId,
        status: "ACTIVE",
        membership: { companyId: access.companyId },
      },
      select: { id: true },
    });
    if (!assignment) return "not-found" as const;

    await tx.driverVehicleAssignment.update({
      where: { id: assignment.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_DRIVER_VEHICLE_RELEASED",
      targetType: "DriverVehicleAssignment",
      targetId: assignment.id,
      metadata: { companyId: access.companyId },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/drivers`);
  if (result === "not-found") return fail("That assignment could not be found.");
  return ok("Vehicle released.");
}
