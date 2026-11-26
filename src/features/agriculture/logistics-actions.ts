"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { haversineKm } from "@/features/logistics/dispatch";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

import { ensureAgricultureEnabled, requireFarmerProfile } from "./access";
import { requireSupplierProfile } from "./supplier-access";
import {
  acceptedWeightKg,
  canTransitionStorage,
  deliveryFeeMinor,
  isEligibleLogisticsCompany,
  storageCapacityAvailable,
} from "./logistics-rules";
import {
  agriculturalDeliverySchema,
  collectionCentreSchema,
  intakeDecisionSchema,
  intakeSchema,
  storageBookingSchema,
  storageDecisionSchema,
  storageFacilitySchema,
} from "./logistics-validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}
const decimal = (value: number) => new Prisma.Decimal(value);
const PATH = "/agriculture/logistics";

async function enabled(): Promise<FormState | null> {
  try {
    await ensureAgricultureEnabled();
    return null;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Agriculture network unavailable.");
  }
}

export async function registerCentreAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = collectionCentreSchema.safeParse({
    name: formValue(formData, "name"),
    location: formValue(formData, "location"),
    region: formValue(formData, "region"),
    district: formValue(formData, "district"),
    capacityKg: formValue(formData, "capacityKg"),
    services: formValue(formData, "services"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const centre = await getDatabase().agriculturalCollectionCentre.create({
    data: {
      operatorFarmerId: farmer.id,
      name: parsed.data.name,
      location: parsed.data.location,
      region: parsed.data.region ?? null,
      district: parsed.data.district ?? null,
      capacityKg: decimal(parsed.data.capacityKg),
      services: parsed.data.services ? { note: parsed.data.services } : Prisma.JsonNull,
    },
    select: { id: true },
  });
  await recordAuditEvent(getDatabase(), {
    actorId: farmer.userId,
    action: "AGRICULTURE_CENTRE_REGISTERED",
    targetType: "AgriculturalCollectionCentre",
    targetId: centre.id,
    metadata: { name: parsed.data.name },
  });
  revalidatePath(PATH);
  return ok("Collection centre registered.");
}

export async function registerStorageFacilityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = storageFacilitySchema.safeParse({
    name: formValue(formData, "name"),
    location: formValue(formData, "location"),
    capacityKg: formValue(formData, "capacityKg"),
    coldChain: formValue(formData, "coldChain"),
    rateAmount: formValue(formData, "rateAmount"),
    rateUnit: formValue(formData, "rateUnit"),
    currency: formValue(formData, "currency"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const supplier = await requireSupplierProfile();
  if (supplier.verificationStatus !== "VERIFIED") return fail("Supplier must be verified.");
  if (supplier.type === "INPUT") return fail("Storage facilities require a service provider.");

  const facility = await getDatabase().agriculturalStorageFacility.create({
    data: {
      supplierId: supplier.id,
      name: parsed.data.name,
      location: parsed.data.location,
      capacityKg: decimal(parsed.data.capacityKg),
      coldChain: parsed.data.coldChain,
      rateAmount: decimal(parsed.data.rateAmount),
      rateUnit: parsed.data.rateUnit,
      currency: parsed.data.currency,
    },
    select: { id: true },
  });
  await recordAuditEvent(getDatabase(), {
    actorId: supplier.userId,
    action: "AGRICULTURE_STORAGE_REGISTERED",
    targetType: "AgriculturalStorageFacility",
    targetId: facility.id,
    metadata: { name: parsed.data.name },
  });
  revalidatePath(PATH);
  return ok("Storage facility registered.");
}

/** Creates a shared DeliveryRequest on the existing engine; no driver assignment here. */
export async function requestAgriculturalDeliveryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = agriculturalDeliverySchema.safeParse({
    companyId: formValue(formData, "companyId"),
    cargoType: formValue(formData, "cargoType"),
    direction: formValue(formData, "direction"),
    quantity: formValue(formData, "quantity"),
    unit: formValue(formData, "unit"),
    pickupName: formValue(formData, "pickupName"),
    pickupAddress: formValue(formData, "pickupAddress"),
    pickup: {
      latitude: formValue(formData, "pickupLatitude"),
      longitude: formValue(formData, "pickupLongitude"),
    },
    dropoffName: formValue(formData, "dropoffName"),
    dropoffAddress: formValue(formData, "dropoffAddress"),
    dropoff: {
      latitude: formValue(formData, "dropoffLatitude"),
      longitude: formValue(formData, "dropoffLongitude"),
    },
    centreId: formValue(formData, "centreId"),
    facilityId: formValue(formData, "facilityId"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const farmer = await requireFarmerProfile();
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in required.");
  const database = getDatabase();
  const company = await database.logisticsCompany.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true, status: true },
  });
  if (!company || !isEligibleLogisticsCompany(company.status)) {
    return fail("Choose a verified logistics company.");
  }

  const distanceKm = Math.round(haversineKm(parsed.data.pickup, parsed.data.dropoff) * 1000) / 1000;
  const fee = new Prisma.Decimal(deliveryFeeMinor(distanceKm)).div(100);
  const created = await database.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.create({
      data: {
        requestNumber: makeDocumentNumber("AR"),
        source: "COMPANY",
        companyId: company.id,
        requesterId: actor.id,
        pickupName: parsed.data.pickupName,
        pickupAddress: parsed.data.pickupAddress,
        pickupLatitude: decimal(parsed.data.pickup.latitude),
        pickupLongitude: decimal(parsed.data.pickup.longitude),
        dropoffName: parsed.data.dropoffName,
        dropoffAddress: parsed.data.dropoffAddress,
        dropoffLatitude: decimal(parsed.data.dropoff.latitude),
        dropoffLongitude: decimal(parsed.data.dropoff.longitude),
        distanceKm: decimal(distanceKm),
        fee,
        currency: "TZS",
        status: "PENDING",
        note: parsed.data.note ?? null,
      },
      select: { id: true, requestNumber: true },
    });
    const delivery = await tx.agriculturalDelivery.create({
      data: {
        farmerId: farmer.id,
        requestId: request.id,
        cargoType: parsed.data.cargoType,
        direction: parsed.data.direction,
        quantity: decimal(parsed.data.quantity),
        unit: parsed.data.unit,
        centreId: parsed.data.centreId ?? null,
        facilityId: parsed.data.facilityId ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "AGRICULTURE_DELIVERY_CREATED",
      targetType: "AgriculturalDelivery",
      targetId: delivery.id,
      metadata: { requestNumber: request.requestNumber, companyId: company.id },
    });
    return request;
  });

  revalidatePath(PATH);
  return ok(`Delivery request ${created.requestNumber} sent to the logistics company.`);
}

export async function recordIntakeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = intakeSchema.safeParse({
    centreId: formValue(formData, "centreId"),
    harvestBatchId: formValue(formData, "harvestBatchId"),
    weighedKg: formValue(formData, "weighedKg"),
    rejectedKg: formValue(formData, "rejectedKg"),
    grade: formValue(formData, "grade"),
    moisturePercent: formValue(formData, "moisturePercent"),
    evidenceNote: formValue(formData, "evidenceNote"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if (parsed.data.rejectedKg > parsed.data.weighedKg)
    return fail("Rejected weight exceeds weighed weight.");
  const farmer = await requireFarmerProfile();
  const database = getDatabase();
  const centre = await database.agriculturalCollectionCentre.findFirst({
    where: { id: parsed.data.centreId, operatorFarmerId: farmer.id, isActive: true },
    select: { id: true },
  });
  if (!centre) return fail("Centre not found or you are not its operator.");
  if (parsed.data.harvestBatchId) {
    const batch = await database.harvestBatch.findFirst({
      where: { id: parsed.data.harvestBatchId, farmerId: farmer.id },
      select: { id: true },
    });
    if (!batch) return fail("Harvest batch not found.");
  }

  await database.$transaction(async (tx) => {
    const row = await tx.agriculturalIntakeRecord.create({
      data: {
        centreId: centre.id,
        farmerId: farmer.id,
        harvestBatchId: parsed.data.harvestBatchId ?? null,
        weighedKg: decimal(parsed.data.weighedKg),
        rejectedKg: decimal(parsed.data.rejectedKg),
        grade: parsed.data.grade ?? null,
        moisturePercent:
          parsed.data.moisturePercent === undefined ? null : decimal(parsed.data.moisturePercent),
        evidenceNote: parsed.data.evidenceNote ?? null,
        inspectedById: farmer.userId,
        status: "GRADED",
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: farmer.userId,
      action: "AGRICULTURE_INTAKE_RECORDED",
      targetType: "AgriculturalIntakeRecord",
      targetId: row.id,
      metadata: {
        centreId: centre.id,
        acceptedKg: acceptedWeightKg(parsed.data.weighedKg, parsed.data.rejectedKg),
      },
    });
  });
  revalidatePath(PATH);
  return ok(
    `Intake recorded. Accepted weight ${acceptedWeightKg(parsed.data.weighedKg, parsed.data.rejectedKg)} kg.`,
  );
}

export async function decideIntakeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = intakeDecisionSchema.safeParse({
    intakeId: formValue(formData, "intakeId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const status =
    parsed.data.decision === "ACCEPT"
      ? "ACCEPTED"
      : parsed.data.decision === "REJECT"
        ? "REJECTED"
        : "GRADED";
  const result = await getDatabase().agriculturalIntakeRecord.updateMany({
    where: {
      id: parsed.data.intakeId,
      centre: { operatorFarmerId: farmer.id },
      status: { in: ["RECEIVED", "GRADED"] },
    },
    data: { status, evidenceNote: parsed.data.note ?? undefined },
  });
  if (result.count === 0) return fail("Intake not found or already decided.");
  revalidatePath(PATH);
  return ok(`Intake ${status.toLowerCase()}.`);
}

export async function bookStorageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = storageBookingSchema.safeParse({
    facilityId: formValue(formData, "facilityId"),
    quantityKg: formValue(formData, "quantityKg"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const database = getDatabase();
  const facility = await database.agriculturalStorageFacility.findFirst({
    where: { id: parsed.data.facilityId, isActive: true },
    select: { capacityKg: true },
  });
  if (!facility) return fail("Facility not available.");
  const held = await database.agriculturalStorageBooking.aggregate({
    where: { facilityId: parsed.data.facilityId, status: { in: ["HELD", "STORED"] } },
    _sum: { quantityKg: true },
  });
  if (
    !storageCapacityAvailable(
      Number(facility.capacityKg.toString()),
      Number(held._sum.quantityKg?.toString() ?? "0"),
      parsed.data.quantityKg,
    )
  ) {
    return fail("Facility does not have that much capacity.");
  }
  const booking = await database.agriculturalStorageBooking.create({
    data: {
      facilityId: parsed.data.facilityId,
      farmerId: farmer.id,
      quantityKg: decimal(parsed.data.quantityKg),
      status: "HELD",
    },
    select: { id: true },
  });
  await recordAuditEvent(database, {
    actorId: farmer.userId,
    action: "AGRICULTURE_STORAGE_BOOKING_CHANGED",
    targetType: "AgriculturalStorageBooking",
    targetId: booking.id,
    metadata: { status: "HELD", quantityKg: parsed.data.quantityKg },
  });
  revalidatePath(PATH);
  return ok("Storage capacity held.");
}

export async function decideStorageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = storageDecisionSchema.safeParse({
    bookingId: formValue(formData, "bookingId"),
    decision: formValue(formData, "decision"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const supplier = await requireSupplierProfile();
  const target = parsed.data.decision === "STORE" ? "STORED" : "RELEASED";
  const result = await getDatabase().$transaction(async (tx) => {
    const booking = await tx.agriculturalStorageBooking.findFirst({
      where: {
        id: parsed.data.bookingId,
        facility: { supplierId: supplier.id },
      },
      select: { id: true, status: true },
    });
    if (!booking || !canTransitionStorage(booking.status, target)) return null;
    await tx.agriculturalStorageBooking.update({
      where: { id: booking.id },
      data: {
        status: target,
        storedAt: target === "STORED" ? new Date() : undefined,
        releasedAt: target === "RELEASED" ? new Date() : undefined,
      },
    });
    await recordAuditEvent(tx, {
      actorId: supplier.userId,
      action: "AGRICULTURE_STORAGE_BOOKING_CHANGED",
      targetType: "AgriculturalStorageBooking",
      targetId: booking.id,
      metadata: { status: target },
    });
    return booking.id;
  });
  if (!result) return fail("That storage status change is not allowed.");
  revalidatePath(PATH);
  return ok(`Storage booking ${target.toLowerCase()}.`);
}
