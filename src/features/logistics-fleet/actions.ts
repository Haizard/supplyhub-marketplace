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

import { canTransitionVehicle } from "./status";
import {
  documentReviewSchema,
  documentSchema,
  fleetSchema,
  maintenanceSchema,
  vehicleSchema,
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

export async function saveFleetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = fleetSchema.safeParse({
    fleetId: formValue(formData, "fleetId"),
    companyId: formValue(formData, "companyId"),
    name: formValue(formData, "name"),
    branchId: formValue(formData, "branchId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/fleet`,
  );
  const database = getDatabase();

  if (parsed.data.branchId) {
    const branch = await database.logisticsBranch.findFirst({
      where: { id: parsed.data.branchId, companyId: access.companyId },
      select: { id: true },
    });
    if (!branch) return fail("That branch is not part of this company.");
  }
  if (parsed.data.fleetId) {
    const existing = await database.logisticsFleet.findFirst({
      where: { id: parsed.data.fleetId, companyId: access.companyId },
      select: { id: true },
    });
    if (!existing) return fail("That fleet is not part of this company.");
  }

  await database.$transaction(async (tx) => {
    if (parsed.data.fleetId) {
      await tx.logisticsFleet.update({
        where: { id: parsed.data.fleetId },
        data: { name: parsed.data.name, branchId: parsed.data.branchId ?? null },
      });
    } else {
      await tx.logisticsFleet.create({
        data: {
          companyId: access.companyId,
          name: parsed.data.name,
          branchId: parsed.data.branchId ?? null,
        },
      });
    }
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_FLEET_CREATED",
      targetType: "LogisticsFleet",
      targetId: parsed.data.fleetId ?? null,
      metadata: { companyId: access.companyId, name: parsed.data.name },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/fleet`);
  return ok(parsed.data.fleetId ? "Fleet updated." : "Fleet created.");
}

export async function saveVehicleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = vehicleSchema.safeParse({
    vehicleId: formValue(formData, "vehicleId"),
    companyId: formValue(formData, "companyId"),
    fleetId: formValue(formData, "fleetId"),
    plate: formValue(formData, "plate"),
    type: formValue(formData, "type"),
    make: formValue(formData, "make"),
    model: formValue(formData, "model"),
    capacityKg: formValue(formData, "capacityKg"),
    ownership: formValue(formData, "ownership"),
    leaseProvider: formValue(formData, "leaseProvider"),
    insuranceExpiresAt: formValue(formData, "insuranceExpiresAt"),
    inspectionExpiresAt: formValue(formData, "inspectionExpiresAt"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/fleet`,
  );
  const database = getDatabase();

  if (parsed.data.fleetId) {
    const fleet = await database.logisticsFleet.findFirst({
      where: { id: parsed.data.fleetId, companyId: access.companyId },
      select: { id: true },
    });
    if (!fleet) return fail("That fleet is not part of this company.");
  }
  if (parsed.data.vehicleId) {
    const existing = await database.logisticsVehicle.findFirst({
      where: { id: parsed.data.vehicleId, companyId: access.companyId },
      select: { id: true },
    });
    if (!existing) return fail("That vehicle is not part of this company.");
  }

  const values = {
    fleetId: parsed.data.fleetId ?? null,
    plate: parsed.data.plate.toUpperCase(),
    type: parsed.data.type,
    make: parsed.data.make ?? null,
    model: parsed.data.model ?? null,
    capacityKg:
      parsed.data.capacityKg !== undefined ? new Prisma.Decimal(parsed.data.capacityKg) : null,
    ownership: parsed.data.ownership,
    leaseProvider: parsed.data.leaseProvider ?? null,
    insuranceExpiresAt: parsed.data.insuranceExpiresAt ?? null,
    inspectionExpiresAt: parsed.data.inspectionExpiresAt ?? null,
  };
  const isEdit = Boolean(parsed.data.vehicleId);
  let vehicleId = parsed.data.vehicleId ?? "";

  try {
    await database.$transaction(async (tx) => {
      if (isEdit) {
        await tx.logisticsVehicle.update({ where: { id: vehicleId }, data: values });
      } else {
        const created = await tx.logisticsVehicle.create({
          data: { companyId: access.companyId, ...values },
          select: { id: true },
        });
        vehicleId = created.id;
      }
      await recordAuditEvent(tx, {
        actorId: access.actorId,
        action: isEdit ? "LOGISTICS_VEHICLE_UPDATED" : "LOGISTICS_VEHICLE_CREATED",
        targetType: "LogisticsVehicle",
        targetId: vehicleId,
        metadata: { companyId: access.companyId, plate: values.plate },
      });
      await appendOutboxEvent(tx, {
        eventType: isEdit ? "logistics.vehicle.updated" : "logistics.vehicle.created",
        aggregateType: "LogisticsVehicle",
        aggregateId: vehicleId,
        payload: { companyId: access.companyId, plate: values.plate },
      });
    });
  } catch {
    return fail("The vehicle could not be saved.");
  }

  revalidatePath(`/logistics/${access.companyId}/fleet`);
  return ok(isEdit ? "Vehicle updated." : "Vehicle added.");
}

export async function updateVehicleStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = z
    .object({
      companyId: z.uuid(),
      vehicleId: z.uuid(),
      toStatus: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE", "RETIRED"]),
    })
    .safeParse({
      companyId: formValue(formData, "companyId"),
      vehicleId: formValue(formData, "vehicleId"),
      toStatus: formValue(formData, "toStatus"),
    });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/fleet`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const vehicle = await tx.logisticsVehicle.findFirst({
      where: { id: parsed.data.vehicleId, companyId: access.companyId },
      select: { id: true, status: true, plate: true },
    });
    if (!vehicle) return "not-found" as const;
    if (!canTransitionVehicle(vehicle.status, parsed.data.toStatus)) return "invalid" as const;
    if (parsed.data.toStatus === "RETIRED") {
      const activeAssignments = await tx.driverVehicleAssignment.count({
        where: { vehicleId: vehicle.id, status: "ACTIVE" },
      });
      if (activeAssignments > 0) return "assigned" as const;
    }

    await tx.logisticsVehicle.update({
      where: { id: vehicle.id },
      data: { status: parsed.data.toStatus },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_VEHICLE_UPDATED",
      targetType: "LogisticsVehicle",
      targetId: vehicle.id,
      metadata: { companyId: access.companyId, plate: vehicle.plate, status: parsed.data.toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/fleet`);
  if (result === "not-found") return fail("That vehicle could not be found.");
  if (result === "invalid") return fail("That status change is not allowed.");
  if (result === "assigned") return fail("Release assigned drivers before retiring this vehicle.");
  return ok("Vehicle status updated.");
}

export async function saveDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = documentSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    vehicleId: formValue(formData, "vehicleId"),
    type: formValue(formData, "type"),
    reference: formValue(formData, "reference"),
    storageKey: formValue(formData, "storageKey"),
    expiresAt: formValue(formData, "expiresAt"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/fleet`,
  );
  const vehicle = await getDatabase().logisticsVehicle.findFirst({
    where: { id: parsed.data.vehicleId, companyId: access.companyId },
    select: { id: true },
  });
  if (!vehicle) return fail("That vehicle is not part of this company.");

  const created = await getDatabase().$transaction(async (tx) => {
    const document = await tx.vehicleDocument.create({
      data: {
        vehicleId: vehicle.id,
        type: parsed.data.type,
        reference: parsed.data.reference ?? null,
        storageKey: parsed.data.storageKey,
        expiresAt: parsed.data.expiresAt ?? null,
        status: "PENDING",
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_VEHICLE_UPDATED",
      targetType: "VehicleDocument",
      targetId: document.id,
      metadata: { companyId: access.companyId, vehicleId: vehicle.id },
    });
    return document;
  });

  revalidatePath(`/logistics/${access.companyId}/fleet`);
  return ok(`Document ${created.id.slice(0, 8)} recorded.`);
}

export async function reviewDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = documentReviewSchema.safeParse({
    documentId: formValue(formData, "documentId"),
    decision: formValue(formData, "decision"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.fleet.manage",
    companyId,
    `/logistics/${companyId}/fleet`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const document = await tx.vehicleDocument.findFirst({
      where: {
        id: parsed.data.documentId,
        vehicle: { companyId: access.companyId },
        status: "PENDING",
      },
      select: { id: true },
    });
    if (!document) return "not-found" as const;
    await tx.vehicleDocument.update({
      where: { id: document.id },
      data: {
        status: parsed.data.decision,
        reviewedById: access.actorId,
        reviewedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_VEHICLE_DOCUMENT_REVIEWED",
      targetType: "VehicleDocument",
      targetId: document.id,
      metadata: { companyId: access.companyId, decision: parsed.data.decision },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/fleet`);
  if (result === "not-found") return fail("That pending document could not be found.");
  return ok("Document reviewed.");
}

export async function saveMaintenanceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = maintenanceSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    vehicleId: formValue(formData, "vehicleId"),
    performedAt: formValue(formData, "performedAt"),
    odometerKm: formValue(formData, "odometerKm"),
    cost: formValue(formData, "cost"),
    currency: formValue(formData, "currency") || "TZS",
    description: formValue(formData, "description"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/fleet`,
  );
  const vehicle = await getDatabase().logisticsVehicle.findFirst({
    where: { id: parsed.data.vehicleId, companyId: access.companyId },
    select: { id: true },
  });
  if (!vehicle) return fail("That vehicle is not part of this company.");

  await getDatabase().$transaction(async (tx) => {
    await tx.vehicleMaintenance.create({
      data: {
        vehicleId: vehicle.id,
        performedAt: parsed.data.performedAt,
        odometerKm: parsed.data.odometerKm ?? null,
        cost: new Prisma.Decimal(parsed.data.cost),
        currency: parsed.data.currency,
        description: parsed.data.description,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_VEHICLE_MAINTENANCE_RECORDED",
      targetType: "LogisticsVehicle",
      targetId: vehicle.id,
      metadata: { companyId: access.companyId, cost: parsed.data.cost },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/fleet`);
  return ok("Maintenance recorded.");
}
