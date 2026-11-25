"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import {
  canReleaseHandover,
  evaluateShareActivation,
  hubHasCapacity,
  isInsuranceCurrent,
  pickupCodeMatches,
} from "./rules";
import {
  hubIntakeSchema,
  hubReleaseSchema,
  hubSchema,
  releaseUsageSchema,
  shareOfferSchema,
  shareResponseSchema,
  shareStatusSchema,
  shareUsageSchema,
  shareVehicleSchema,
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
const decimal = (value: number) => new Prisma.Decimal(value);
const path = (companyId: string) => `/logistics/${companyId}/sharing`;

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

/** Records every platform-visible sharing decision so accountability is auditable. */
async function auditShare(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: "FLEET_SHARE_CREATED" | "FLEET_SHARE_STATUS_CHANGED" | "FLEET_SHARE_VEHICLE_CHANGED",
  agreementId: string,
  metadata: Prisma.InputJsonObject,
): Promise<void> {
  await recordAuditEvent(tx, {
    actorId,
    action,
    targetType: "FleetShareAgreement",
    targetId: agreementId,
    metadata,
  });
}

const agreementVehiclesSelect = {
  vehicles: {
    where: { active: true },
    select: {
      vehicle: {
        select: { id: true, plate: true, status: true, insuranceExpiresAt: true },
      },
    },
  },
} satisfies Prisma.FleetShareAgreementSelect;

/** Owner creates an offer. Creating it is the owner's explicit consent. */
export async function createShareOfferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = shareOfferSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    partnerCompanyCode: formValue(formData, "partnerCompanyCode"),
    type: formValue(formData, "type"),
    accountable: formValue(formData, "accountable"),
    insurancePolicyRef: formValue(formData, "insurancePolicyRef"),
    insuranceExpiresAt: formValue(formData, "insuranceExpiresAt"),
    effectiveFrom: formValue(formData, "effectiveFrom"),
    effectiveTo: formValue(formData, "effectiveTo"),
    rateAmount: formValue(formData, "rateAmount"),
    rateCurrency: formValue(formData, "rateCurrency"),
    liabilityTerms: formValue(formData, "liabilityTerms"),
    vehicleIds: formData.getAll("vehicleIds").map(String),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  if (access.companyStatus !== "APPROVED") {
    return fail("Your company must be verified before offering capacity.");
  }

  const database = getDatabase();
  const partner = await database.logisticsCompany.findUnique({
    where: { companyCode: parsed.data.partnerCompanyCode.trim().toUpperCase() },
    select: { id: true, status: true },
  });
  if (!partner) return fail("No company matches that company code.");
  if (partner.id === access.companyId) {
    return fail("A company cannot share capacity with itself.");
  }
  if (partner.status !== "APPROVED") {
    return fail("The partner company is not verified by the platform.");
  }

  const vehicleIds = [...new Set(parsed.data.vehicleIds)];
  const vehicles = await database.logisticsVehicle.findMany({
    where: { id: { in: vehicleIds }, companyId: access.companyId },
    select: { id: true, plate: true, status: true, insuranceExpiresAt: true },
  });
  if (vehicles.length !== vehicleIds.length) {
    return fail("One or more vehicles do not belong to your company.");
  }
  const now = new Date();
  const unusable = vehicles.find(
    (vehicle) =>
      vehicle.status !== "ACTIVE" ||
      (vehicle.insuranceExpiresAt !== null && !isInsuranceCurrent(vehicle.insuranceExpiresAt, now)),
  );
  if (unusable) {
    return fail(`Vehicle ${unusable.plate} is inactive or has expired insurance.`);
  }

  const committed = await database.fleetShareVehicle.findMany({
    where: {
      vehicleId: { in: vehicleIds },
      active: true,
      agreement: { status: "ACTIVE" },
    },
    select: { vehicle: { select: { plate: true } } },
  });
  if (committed.length > 0) {
    const plate = committed[0]?.vehicle.plate ?? "This vehicle";
    return fail(`${plate} is already committed under another active agreement.`);
  }

  const accountableCompanyId = parsed.data.accountable === "OWNER" ? access.companyId : partner.id;

  const agreementId = await database.$transaction(async (tx) => {
    const agreement = await tx.fleetShareAgreement.create({
      data: {
        agreementNumber: makeDocumentNumber("FS"),
        ownerCompanyId: access.companyId,
        partnerCompanyId: partner.id,
        type: parsed.data.type,
        status: "PENDING_PARTNER",
        rateAmount: parsed.data.rateAmount === undefined ? null : decimal(parsed.data.rateAmount),
        rateCurrency: parsed.data.rateCurrency ?? null,
        liabilityTerms: parsed.data.liabilityTerms ?? null,
        insurancePolicyRef: parsed.data.insurancePolicyRef,
        insuranceExpiresAt: parsed.data.insuranceExpiresAt,
        accountableCompanyId,
        ownerConsentedAt: now,
        ownerConsentedById: access.actorId,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveTo: parsed.data.effectiveTo ?? null,
        createdById: access.actorId,
      },
      select: { id: true },
    });
    await tx.fleetShareVehicle.createMany({
      data: vehicleIds.map((vehicleId) => ({ agreementId: agreement.id, vehicleId })),
    });
    await auditShare(tx, access.actorId, "FLEET_SHARE_CREATED", agreement.id, {
      companyId: access.companyId,
      partnerCompanyId: partner.id,
      vehicleIds,
    });
    return agreement.id;
  });

  revalidatePath(path(access.companyId));
  return ok(`Offer ${agreementId.slice(0, 8)} sent. The partner must consent before it activates.`);
}

/** Partner accepts or declines. Acceptance runs the full activation gate. */
export async function respondShareOfferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = shareResponseSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    agreementId: formValue(formData, "agreementId"),
    decision: formValue(formData, "decision"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const agreement = await database.fleetShareAgreement.findUnique({
    where: { id: parsed.data.agreementId },
    select: {
      id: true,
      status: true,
      ownerCompanyId: true,
      partnerCompanyId: true,
      accountableCompanyId: true,
      insurancePolicyRef: true,
      insuranceExpiresAt: true,
      effectiveFrom: true,
      effectiveTo: true,
      ownerConsentedAt: true,
      partnerConsentedAt: true,
      ownerCompany: { select: { status: true } },
      ...agreementVehiclesSelect,
    },
  });
  if (!agreement) return fail("Agreement not found.");
  if (agreement.partnerCompanyId !== parsed.data.companyId) {
    return fail("Only the invited partner can answer this offer.");
  }

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    agreement.partnerCompanyId,
    path(agreement.partnerCompanyId),
  );
  if (agreement.status !== "PENDING_PARTNER") {
    return fail("This offer is no longer awaiting a response.");
  }

  if (parsed.data.decision === "DECLINE") {
    await database.$transaction(async (tx) => {
      await tx.fleetShareAgreement.update({
        where: { id: agreement.id },
        data: { status: "DECLINED", terminationReason: "Declined by partner" },
      });
      await auditShare(tx, access.actorId, "FLEET_SHARE_STATUS_CHANGED", agreement.id, {
        companyId: access.companyId,
        status: "DECLINED",
      });
    });
    revalidatePath(path(access.companyId));
    return ok("Offer declined.");
  }

  const committed = await database.fleetShareVehicle.findMany({
    where: {
      vehicleId: { in: agreement.vehicles.map((link) => link.vehicle.id) },
      active: true,
      agreementId: { not: agreement.id },
      agreement: { status: "ACTIVE" },
    },
    select: { vehicle: { select: { plate: true } } },
  });
  const committedPlates = new Set(committed.map((row) => row.vehicle.plate));

  const evaluation = evaluateShareActivation({
    status: agreement.status,
    ownerApproved: agreement.ownerCompany.status === "APPROVED",
    partnerApproved: access.companyStatus === "APPROVED",
    ownerConsentedAt: agreement.ownerConsentedAt,
    partnerConsentedAt: new Date(),
    insurancePolicyRef: agreement.insurancePolicyRef,
    insuranceExpiresAt: agreement.insuranceExpiresAt,
    effectiveFrom: agreement.effectiveFrom,
    effectiveTo: agreement.effectiveTo,
    accountableIsParty:
      agreement.accountableCompanyId === agreement.ownerCompanyId ||
      agreement.accountableCompanyId === agreement.partnerCompanyId,
    vehicles: agreement.vehicles.map((link) => ({
      plate: link.vehicle.plate,
      status: link.vehicle.status,
      insuranceExpiresAt: link.vehicle.insuranceExpiresAt,
      committedElsewhere: committedPlates.has(link.vehicle.plate),
    })),
  });
  if (!evaluation.ok) return fail(evaluation.reason);

  await database.$transaction(async (tx) => {
    await tx.fleetShareAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "ACTIVE",
        partnerConsentedAt: new Date(),
        partnerConsentedById: access.actorId,
      },
    });
    await auditShare(tx, access.actorId, "FLEET_SHARE_STATUS_CHANGED", agreement.id, {
      companyId: access.companyId,
      status: "ACTIVE",
    });
  });

  revalidatePath(path(access.companyId));
  return ok("Agreement activated. Capacity is now shared with recorded accountability.");
}

/** Either party suspends, resumes or terminates the agreement. */
export async function changeShareStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = shareStatusSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    agreementId: formValue(formData, "agreementId"),
    action: formValue(formData, "action"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );

  const database = getDatabase();
  const agreement = await database.fleetShareAgreement.findFirst({
    where: {
      id: parsed.data.agreementId,
      OR: [{ ownerCompanyId: access.companyId }, { partnerCompanyId: access.companyId }],
    },
    select: {
      id: true,
      status: true,
      insurancePolicyRef: true,
      insuranceExpiresAt: true,
      ownerConsentedAt: true,
      partnerConsentedAt: true,
      ownerCompany: { select: { status: true } },
      partnerCompany: { select: { status: true } },
    },
  });
  if (!agreement) return fail("Agreement not found.");

  if (parsed.data.action === "SUSPEND") {
    if (agreement.status !== "ACTIVE") return fail("Only an active agreement can be suspended.");
    await database.$transaction(async (tx) => {
      await tx.fleetShareAgreement.update({
        where: { id: agreement.id },
        data: { status: "SUSPENDED", suspendedAt: new Date() },
      });
      await auditShare(tx, access.actorId, "FLEET_SHARE_STATUS_CHANGED", agreement.id, {
        companyId: access.companyId,
        status: "SUSPENDED",
      });
    });
    revalidatePath(path(access.companyId));
    return ok("Agreement suspended.");
  }

  if (parsed.data.action === "RESUME") {
    if (agreement.status !== "SUSPENDED") return fail("Only a suspended agreement can resume.");
    if (
      !agreement.insurancePolicyRef?.trim() ||
      !isInsuranceCurrent(agreement.insuranceExpiresAt)
    ) {
      return fail("Insurance must be current before resuming.");
    }
    if (
      agreement.ownerCompany.status !== "APPROVED" ||
      agreement.partnerCompany.status !== "APPROVED"
    ) {
      return fail("Both companies must still be verified to resume.");
    }
    await database.$transaction(async (tx) => {
      await tx.fleetShareAgreement.update({
        where: { id: agreement.id },
        data: { status: "ACTIVE", suspendedAt: null },
      });
      await auditShare(tx, access.actorId, "FLEET_SHARE_STATUS_CHANGED", agreement.id, {
        companyId: access.companyId,
        status: "ACTIVE",
      });
    });
    revalidatePath(path(access.companyId));
    return ok("Agreement resumed.");
  }

  if (agreement.status === "TERMINATED") return fail("This agreement is already terminated.");
  await database.$transaction(async (tx) => {
    await tx.fleetShareAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "TERMINATED",
        terminatedAt: new Date(),
        terminationReason: parsed.data.reason ?? null,
      },
    });
    await tx.fleetShareUsage.updateMany({
      where: { agreementId: agreement.id, status: { in: ["RESERVED", "IN_USE"] } },
      data: { status: "CANCELLED", endedAt: new Date() },
    });
    await auditShare(tx, access.actorId, "FLEET_SHARE_STATUS_CHANGED", agreement.id, {
      companyId: access.companyId,
      status: "TERMINATED",
    });
  });
  revalidatePath(path(access.companyId));
  return ok("Agreement terminated and open uses released.");
}

/** Owner adds or removes a shared vehicle. Removing an in-use vehicle is blocked. */
export async function setShareVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = shareVehicleSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    agreementId: formValue(formData, "agreementId"),
    vehicleId: formValue(formData, "vehicleId"),
    active: formValue(formData, "active"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  const database = getDatabase();
  const agreement = await database.fleetShareAgreement.findFirst({
    where: {
      id: parsed.data.agreementId,
      ownerCompanyId: access.companyId,
      status: { in: ["PENDING_PARTNER", "ACTIVE", "SUSPENDED"] },
    },
    select: { id: true, status: true },
  });
  if (!agreement) return fail("Agreement not found or not editable.");

  const active = parsed.data.active === "true";

  if (!active) {
    const inUse = await database.fleetShareUsage.findFirst({
      where: {
        agreementId: agreement.id,
        vehicleId: parsed.data.vehicleId,
        status: { in: ["RESERVED", "IN_USE"] },
      },
      select: { id: true },
    });
    if (inUse) return fail("That vehicle is in use and cannot be withdrawn yet.");
  } else {
    const vehicle = await database.logisticsVehicle.findFirst({
      where: {
        id: parsed.data.vehicleId,
        companyId: access.companyId,
        status: "ACTIVE",
      },
      select: { id: true, plate: true },
    });
    if (!vehicle) return fail("That vehicle is not available to share.");
    const committed = await database.fleetShareVehicle.findFirst({
      where: {
        vehicleId: vehicle.id,
        active: true,
        agreementId: { not: agreement.id },
        agreement: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    if (committed) return fail("That vehicle is already committed under another agreement.");
  }

  await database.$transaction(async (tx) => {
    await tx.fleetShareVehicle.upsert({
      where: {
        agreementId_vehicleId: {
          agreementId: agreement.id,
          vehicleId: parsed.data.vehicleId,
        },
      },
      create: {
        agreementId: agreement.id,
        vehicleId: parsed.data.vehicleId,
        active,
      },
      update: { active },
    });
    await auditShare(tx, access.actorId, "FLEET_SHARE_VEHICLE_CHANGED", agreement.id, {
      companyId: access.companyId,
      vehicleId: parsed.data.vehicleId,
      active,
    });
  });

  revalidatePath(path(access.companyId));
  return ok(active ? "Vehicle added to the shared pool." : "Vehicle withdrawn from the pool.");
}

/** Partner reserves a shared vehicle and records which company is accountable. */
export async function reserveSharedVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = shareUsageSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    agreementId: formValue(formData, "agreementId"),
    vehicleId: formValue(formData, "vehicleId"),
    jobId: formValue(formData, "jobId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  const database = getDatabase();
  const agreement = await database.fleetShareAgreement.findFirst({
    where: {
      id: parsed.data.agreementId,
      partnerCompanyId: access.companyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      accountableCompanyId: true,
      insurancePolicyRef: true,
      insuranceExpiresAt: true,
      effectiveFrom: true,
      effectiveTo: true,
      vehicles: {
        where: { active: true, vehicleId: parsed.data.vehicleId },
        select: { id: true },
      },
    },
  });
  if (!agreement) return fail("No active agreement shares that vehicle with you.");
  if (agreement.vehicles.length === 0) return fail("That vehicle is not in the shared pool.");
  const now = new Date();
  if (
    !agreement.insurancePolicyRef?.trim() ||
    !isInsuranceCurrent(agreement.insuranceExpiresAt, now) ||
    agreement.effectiveFrom.getTime() > now.getTime() ||
    (agreement.effectiveTo && agreement.effectiveTo.getTime() <= now.getTime())
  ) {
    return fail("This agreement is not currently valid (insurance or effective window).");
  }

  const alreadyReserved = await database.fleetShareUsage.findFirst({
    where: {
      vehicleId: parsed.data.vehicleId,
      status: { in: ["RESERVED", "IN_USE"] },
    },
    select: { id: true },
  });
  if (alreadyReserved) return fail("That vehicle is already reserved.");

  let jobId: string | null = null;
  if (parsed.data.jobId) {
    const job = await database.deliveryJob.findFirst({
      where: {
        id: parsed.data.jobId,
        companyId: access.companyId,
        status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
      },
      select: { id: true },
    });
    if (!job) return fail("That job is not an active job of your company.");
    jobId = job.id;
  }

  await database.$transaction(async (tx) => {
    await tx.fleetShareUsage.create({
      data: {
        agreementId: agreement.id,
        vehicleId: parsed.data.vehicleId,
        usingCompanyId: access.companyId,
        accountableCompanyId: agreement.accountableCompanyId,
        jobId,
        status: "RESERVED",
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "FLEET_SHARE_STATUS_CHANGED",
      targetType: "FleetShareAgreement",
      targetId: agreement.id,
      metadata: {
        companyId: access.companyId,
        vehicleId: parsed.data.vehicleId,
        accountableCompanyId: agreement.accountableCompanyId,
        reserved: true,
      },
    });
  });

  revalidatePath(path(access.companyId));
  return ok("Shared vehicle reserved. Accountability is recorded on the agreement.");
}

export async function releaseShareUsageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = releaseUsageSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    usageId: formValue(formData, "usageId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  const database = getDatabase();
  const usage = await database.fleetShareUsage.findFirst({
    where: {
      id: parsed.data.usageId,
      status: { in: ["RESERVED", "IN_USE"] },
      agreement: {
        OR: [{ ownerCompanyId: access.companyId }, { partnerCompanyId: access.companyId }],
      },
    },
    select: { id: true, agreementId: true },
  });
  if (!usage) return fail("No open shared-vehicle use found.");

  await database.$transaction(async (tx) => {
    await tx.fleetShareUsage.update({
      where: { id: usage.id },
      data: { status: "RELEASED", endedAt: new Date() },
    });
    await auditShare(tx, access.actorId, "FLEET_SHARE_STATUS_CHANGED", usage.agreementId, {
      companyId: access.companyId,
      usageId: usage.id,
      released: true,
    });
  });

  revalidatePath(path(access.companyId));
  return ok("Shared vehicle released.");
}

/** Creates or updates a hub. Hub codes are unique per company. */
export async function saveParcelHubAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = hubSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    hubCode: formValue(formData, "hubCode"),
    name: formValue(formData, "name"),
    address: formValue(formData, "address"),
    city: formValue(formData, "city"),
    latitude: formValue(formData, "latitude"),
    longitude: formValue(formData, "longitude"),
    capacity: formValue(formData, "capacity"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  if (access.companyStatus !== "APPROVED") {
    return fail("Your company must be verified before operating a parcel hub.");
  }

  const database = getDatabase();
  const hubCode = parsed.data.hubCode.trim().toUpperCase();
  const existing = await database.parcelHub.findUnique({
    where: { companyId_hubCode: { companyId: access.companyId, hubCode } },
    select: { id: true, capacity: true },
  });
  if (existing) {
    const stored = await database.parcelHubHandover.count({
      where: { hubId: existing.id, status: { in: ["RECEIVED", "STORED"] } },
    });
    if (parsed.data.capacity < stored) {
      return fail(`Capacity cannot be below the ${stored} parcels currently stored.`);
    }
  }

  await database.$transaction(async (tx) => {
    const hub = await tx.parcelHub.upsert({
      where: { companyId_hubCode: { companyId: access.companyId, hubCode } },
      create: {
        companyId: access.companyId,
        hubCode,
        name: parsed.data.name,
        address: parsed.data.address,
        city: parsed.data.city ?? null,
        latitude: parsed.data.latitude === undefined ? null : decimal(parsed.data.latitude),
        longitude: parsed.data.longitude === undefined ? null : decimal(parsed.data.longitude),
        capacity: parsed.data.capacity,
        createdById: access.actorId,
      },
      update: {
        name: parsed.data.name,
        address: parsed.data.address,
        city: parsed.data.city ?? null,
        latitude: parsed.data.latitude === undefined ? null : decimal(parsed.data.latitude),
        longitude: parsed.data.longitude === undefined ? null : decimal(parsed.data.longitude),
        capacity: parsed.data.capacity,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARCEL_HUB_SAVED",
      targetType: "ParcelHub",
      targetId: hub.id,
      metadata: { companyId: access.companyId, hubCode },
    });
  });

  revalidatePath(path(access.companyId));
  return ok(existing ? "Hub updated." : "Hub registered.");
}

/** Records custody intake and returns the pickup code exactly once. */
export async function recordHubIntakeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = hubIntakeSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    hubId: formValue(formData, "hubId"),
    trackingRef: formValue(formData, "trackingRef"),
    direction: formValue(formData, "direction"),
    jobId: formValue(formData, "jobId"),
    notes: formValue(formData, "notes"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  const database = getDatabase();
  const hub = await database.parcelHub.findFirst({
    where: { id: parsed.data.hubId, companyId: access.companyId },
    select: { id: true, capacity: true, status: true },
  });
  if (!hub || hub.status !== "ACTIVE") return fail("Choose an active hub of your company.");

  const stored = await database.parcelHubHandover.count({
    where: { hubId: hub.id, status: { in: ["RECEIVED", "STORED"] } },
  });
  if (!hubHasCapacity(stored, hub.capacity)) {
    return fail(`Hub is at capacity (${stored}/${hub.capacity}). Release a parcel first.`);
  }

  let jobId: string | null = null;
  if (parsed.data.jobId) {
    const job = await database.deliveryJob.findFirst({
      where: { id: parsed.data.jobId, companyId: access.companyId },
      select: { id: true },
    });
    if (!job) return fail("That job does not belong to your company.");
    jobId = job.id;
  }

  const pickupCode = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const handoverId = await database.$transaction(async (tx) => {
    const handover = await tx.parcelHubHandover.create({
      data: {
        hubId: hub.id,
        companyId: access.companyId,
        trackingRef: parsed.data.trackingRef,
        direction: parsed.data.direction,
        status: "STORED",
        jobId,
        custodianMemberId: access.memberId,
        receivedById: access.actorId,
        pickupCode,
        notes: parsed.data.notes ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARCEL_HANDOVER_RECORDED",
      targetType: "ParcelHubHandover",
      targetId: handover.id,
      metadata: {
        companyId: access.companyId,
        hubId: hub.id,
        trackingRef: parsed.data.trackingRef,
        direction: parsed.data.direction,
      },
    });
    return handover.id;
  });

  revalidatePath(path(access.companyId));
  return ok(
    `Parcel ${handoverId.slice(0, 8)} stored. Pickup code (show once to the recipient): ${pickupCode}`,
  );
}

/** Releases a parcel only with the matching pickup code. */
export async function releaseHubParcelAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = hubReleaseSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    handoverId: formValue(formData, "handoverId"),
    pickupCode: formValue(formData, "pickupCode"),
    releasedToName: formValue(formData, "releasedToName"),
    releasedToPhone: formValue(formData, "releasedToPhone"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.fleet.share",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  const database = getDatabase();
  const handover = await database.parcelHubHandover.findFirst({
    where: { id: parsed.data.handoverId, companyId: access.companyId },
    select: {
      id: true,
      hubId: true,
      status: true,
      pickupCode: true,
      pickupCodeVerifiedAt: true,
    },
  });
  if (!handover) return fail("Parcel not found.");
  if (!canReleaseHandover(handover.status, handover.pickupCodeVerifiedAt)) {
    return fail("This parcel is not awaiting release.");
  }
  if (!pickupCodeMatches(handover.pickupCode, parsed.data.pickupCode)) {
    return fail("The pickup code does not match.");
  }

  await database.$transaction(async (tx) => {
    await tx.parcelHubHandover.update({
      where: { id: handover.id },
      data: {
        status: "RELEASED",
        pickupCodeVerifiedAt: new Date(),
        releasedAt: new Date(),
        releasedToName: parsed.data.releasedToName,
        releasedToPhone: parsed.data.releasedToPhone ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARCEL_HANDOVER_RECORDED",
      targetType: "ParcelHubHandover",
      targetId: handover.id,
      metadata: {
        companyId: access.companyId,
        hubId: handover.hubId,
        released: true,
      },
    });
  });

  revalidatePath(path(access.companyId));
  return ok("Parcel released and custody closed.");
}
