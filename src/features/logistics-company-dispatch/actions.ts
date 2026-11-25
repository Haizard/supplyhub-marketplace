"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import {
  codesMatch,
  generateHandoverCode,
  handoverExpiry,
  isHandoverExpired,
} from "@/features/logistics/otp";
import { haversineKm } from "@/features/logistics/dispatch";
import { canActorTransition, canTransitionJob } from "@/features/logistics/status";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getSessionActor } from "@/server/auth/session";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import { pickCompanyDriver, type CompanyDriverCandidate } from "./scoring";
import {
  companyRequestSchema,
  dispatchSchema,
  jobStatusSchema,
  reassignSchema,
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

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

/** Company-originated delivery request on the shared delivery request table. */
export async function createCompanyRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to request a delivery.");

  const parsed = companyRequestSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    contractId: formValue(formData, "contractId"),
    pickupName: formValue(formData, "pickupName"),
    pickupPhone: formValue(formData, "pickupPhone"),
    pickupAddress: formValue(formData, "pickupAddress"),
    pickupLatitude: formValue(formData, "pickupLatitude"),
    pickupLongitude: formValue(formData, "pickupLongitude"),
    dropoffName: formValue(formData, "dropoffName"),
    dropoffPhone: formValue(formData, "dropoffPhone"),
    dropoffAddress: formValue(formData, "dropoffAddress"),
    dropoffLatitude: formValue(formData, "dropoffLatitude"),
    dropoffLongitude: formValue(formData, "dropoffLongitude"),
    distanceKm: formValue(formData, "distanceKm"),
    fee: formValue(formData, "fee"),
    currency: formValue(formData, "currency") || "TZS",
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/dispatch`,
  );
  const database = getDatabase();

  if (parsed.data.contractId) {
    const contract = await database.logisticsContract.findFirst({
      where: { id: parsed.data.contractId, companyId: access.companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!contract) return fail("That active contract is not linked to this company.");
  }

  const created = await database.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.create({
      data: {
        requestNumber: makeDocumentNumber("CR"),
        source: "COMPANY",
        companyId: access.companyId,
        contractId: parsed.data.contractId ?? null,
        requesterId: actor.id,
        pickupName: parsed.data.pickupName,
        pickupPhone: parsed.data.pickupPhone ?? null,
        pickupAddress: parsed.data.pickupAddress,
        pickupLatitude: decimal(parsed.data.pickupLatitude),
        pickupLongitude: decimal(parsed.data.pickupLongitude),
        dropoffName: parsed.data.dropoffName,
        dropoffPhone: parsed.data.dropoffPhone ?? null,
        dropoffAddress: parsed.data.dropoffAddress,
        dropoffLatitude: decimal(parsed.data.dropoffLatitude),
        dropoffLongitude: decimal(parsed.data.dropoffLongitude),
        distanceKm: decimal(parsed.data.distanceKm),
        fee: decimal(parsed.data.fee),
        currency: parsed.data.currency,
        status: "PENDING",
        note: parsed.data.note ?? null,
      },
      select: { id: true, requestNumber: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_COMPANY_REQUEST_CREATED",
      targetType: "DeliveryRequest",
      targetId: request.id,
      metadata: {
        companyId: access.companyId,
        requestNumber: request.requestNumber,
        contractId: parsed.data.contractId ?? undefined,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.company.request_created",
      aggregateType: "DeliveryRequest",
      aggregateId: request.id,
      payload: { companyId: access.companyId, requestNumber: request.requestNumber },
    });
    return request;
  });

  revalidatePath(`/logistics/${access.companyId}/dispatch`);
  return ok(`Request ${created.requestNumber} created. Dispatch when a driver is available.`);
}

/** Assigns a company driver using the same job lifecycle as platform couriers. */
export async function dispatchCompanyJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = dispatchSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    requestId: formValue(formData, "requestId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/dispatch`,
  );
  const database = getDatabase();

  const request = await database.deliveryRequest.findFirst({
    where: { id: parsed.data.requestId, companyId: access.companyId, source: "COMPANY" },
    select: {
      id: true,
      status: true,
      requestNumber: true,
      contractId: true,
      pickupLatitude: true,
      pickupLongitude: true,
      jobs: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
        select: { id: true },
      },
    },
  });
  if (!request) return fail("That request is not part of this company.");
  if (request.status !== "PENDING") return fail("Only pending requests can be dispatched.");
  if (request.jobs.length > 0) return fail("This request already has an active delivery job.");

  const pickup = {
    latitude: Number(request.pickupLatitude.toString()),
    longitude: Number(request.pickupLongitude.toString()),
  };
  const memberships = await database.driverCompanyMembership.findMany({
    where: { companyId: access.companyId, status: "ACTIVE" },
    select: {
      id: true,
      driver: { select: { rating: true, deliveryAgentId: true } },
      assignments: { where: { status: "ACTIVE" }, select: { vehicleId: true } },
      jobs: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
        select: { id: true },
      },
    },
  });
  const settings = await database.logisticsCompanySettings.findUnique({
    where: { companyId: access.companyId },
    select: { defaultServiceRadius: true },
  });
  const branches = await database.logisticsBranch.findMany({
    where: { companyId: access.companyId, isActive: true },
    select: { latitude: true, longitude: true },
  });
  const radius = Number(settings?.defaultServiceRadius ?? 15);

  const candidates: CompanyDriverCandidate[] = memberships.map((membership) => {
    const inServiceArea = branches.some((branch) => {
      if (!branch.latitude || !branch.longitude) return false;
      return (
        haversineKm(pickup, {
          latitude: Number(branch.latitude.toString()),
          longitude: Number(branch.longitude.toString()),
        }) <= radius
      );
    });
    return {
      membershipId: membership.id,
      distanceKm: 0,
      rating: Number(membership.driver.rating.toString()),
      completedTrips: 0,
      inServiceArea,
      hasVehicle: membership.assignments.length > 0,
      activeJobs: membership.jobs.length,
      capacity: 3,
    };
  });

  const winner = pickCompanyDriver(candidates);
  if (!winner) return fail("No company driver with a vehicle is available in the service area.");

  const jobNumber = makeDocumentNumber("CJ");
  await database.$transaction(async (tx) => {
    const job = await tx.deliveryJob.create({
      data: {
        jobNumber,
        requestId: request.id,
        companyId: access.companyId,
        contractId: request.contractId,
        driverMembershipId: winner.membershipId,
        status: "ASSIGNED",
        otpCode: generateHandoverCode(),
        otpExpiresAt: handoverExpiry(),
        assignments: {
          create: {
            driverMembershipId: winner.membershipId,
            score: new Prisma.Decimal(winner.score.toFixed(3)),
          },
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "ASSIGNED",
            actorId: access.actorId,
            note: `Assigned by company dispatch (score ${winner.score}).`,
          },
        },
      },
      select: { id: true },
    });
    await tx.deliveryRequest.update({
      where: { id: request.id },
      data: { status: "ASSIGNED" },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_COMPANY_JOB_ASSIGNED",
      targetType: "DeliveryJob",
      targetId: job.id,
      metadata: {
        companyId: access.companyId,
        jobNumber,
        membershipId: winner.membershipId,
        score: winner.score,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.company.job_assigned",
      aggregateType: "DeliveryJob",
      aggregateId: job.id,
      payload: { companyId: access.companyId, jobNumber, membershipId: winner.membershipId },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/dispatch`);
  revalidatePath(`/logistics/${access.companyId}/jobs`);
  return ok(`Job ${jobNumber} assigned to a company driver.`);
}

/** Reassignment closes the old assignment instead of deleting it. */
export async function reassignCompanyJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = reassignSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    jobId: formValue(formData, "jobId"),
    membershipId: formValue(formData, "membershipId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/jobs`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const job = await tx.deliveryJob.findFirst({
      where: {
        id: parsed.data.jobId,
        companyId: access.companyId,
        status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
      },
      select: { id: true, jobNumber: true, driverMembershipId: true },
    });
    if (!job) return "not-active" as const;
    if (job.driverMembershipId === parsed.data.membershipId) return "same-driver" as const;

    const membership = await tx.driverCompanyMembership.findFirst({
      where: { id: parsed.data.membershipId, companyId: access.companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) return "no-membership" as const;

    const activeJobs = await tx.deliveryJob.count({
      where: {
        driverMembershipId: membership.id,
        status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
      },
    });
    if (activeJobs > 0) return "busy" as const;

    const current = await tx.deliveryAssignment.findFirst({
      where: { jobId: job.id, releasedAt: null },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    if (current) {
      await tx.deliveryAssignment.update({
        where: { id: current.id },
        data: { releasedAt: new Date() },
      });
    }
    await tx.deliveryAssignment.create({
      data: {
        jobId: job.id,
        driverMembershipId: membership.id,
        score: new Prisma.Decimal(0),
      },
    });
    await tx.deliveryJob.update({
      where: { id: job.id },
      data: { driverMembershipId: membership.id },
    });
    await tx.deliveryStatusHistory.create({
      data: {
        jobId: job.id,
        fromStatus: null,
        toStatus: "ASSIGNED",
        actorId: access.actorId,
        note: `Reassigned by company dispatch.`,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_COMPANY_JOB_REASSIGNED",
      targetType: "DeliveryJob",
      targetId: job.id,
      metadata: { companyId: access.companyId, jobNumber: job.jobNumber },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/jobs`);
  if (result === "not-active") return fail("That job cannot be reassigned.");
  if (result === "same-driver") return fail("That driver is already assigned.");
  if (result === "no-membership") return fail("That driver is not active in this company.");
  if (result === "busy") return fail("That driver already has an active job.");
  return ok("Job reassigned.");
}

/** Company-side transition using the shared job state machine. */
export async function transitionCompanyJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = jobStatusSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    jobId: formValue(formData, "jobId"),
    toStatus: formValue(formData, "toStatus"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/jobs`,
  );
  const { jobId, toStatus, note } = parsed.data;
  const database = getDatabase();

  const result = await database.$transaction(async (tx) => {
    const job = await tx.deliveryJob.findFirst({
      where: { id: jobId, companyId: access.companyId },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        requestId: true,
        contractId: true,
        driverMembershipId: true,
      },
    });
    if (!job) return "not-found" as const;
    if (!canTransitionJob(job.status, toStatus)) return "invalid" as const;
    if (!canActorTransition(job.status, toStatus, "admin")) return "forbidden" as const;

    const moved = await tx.deliveryJob.updateMany({
      where: { id: job.id, status: job.status },
      data: {
        status: toStatus,
        acceptedAt: toStatus === "ACCEPTED" ? new Date() : undefined,
        pickedUpAt: toStatus === "TO_PICKUP" || toStatus === "AT_PICKUP" ? new Date() : undefined,
        deliveredAt: toStatus === "DELIVERED" ? new Date() : undefined,
        cancelledAt: toStatus === "CANCELLED" ? new Date() : undefined,
        otpCode: toStatus === "DELIVERED" ? null : undefined,
        otpExpiresAt: toStatus === "DELIVERED" ? null : undefined,
      },
    });
    if (moved.count === 0) return "conflict" as const;

    await tx.deliveryStatusHistory.create({
      data: {
        jobId: job.id,
        fromStatus: job.status,
        toStatus,
        actorId: access.actorId,
        note: note ?? null,
      },
    });

    if (toStatus === "DELIVERED" || toStatus === "CANCELLED") {
      const requestStatus = toStatus === "DELIVERED" ? "COMPLETED" : "CANCELLED";
      await tx.deliveryRequest.updateMany({
        where: { id: job.requestId, status: "ASSIGNED" },
        data: { status: requestStatus },
      });
    }

    if (toStatus === "DELIVERED" && job.contractId) {
      const contract = await tx.logisticsContract.findUnique({
        where: { id: job.contractId },
        select: { currency: true },
      });
      if (contract) {
        const request = await tx.deliveryRequest.findUnique({
          where: { id: job.requestId },
          select: { fee: true },
        });
        if (request) {
          await tx.contractDelivery.upsert({
            where: { deliveryJobId: job.id },
            create: {
              contractId: job.contractId,
              deliveryJobId: job.id,
              reference: job.jobNumber,
              status: "COMPLETED",
              charge: request.fee,
              currency: contract.currency,
              deliveredAt: new Date(),
            },
            update: {},
          });
        }
      }
    }

    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_COMPANY_JOB_STATUS_CHANGED",
      targetType: "DeliveryJob",
      targetId: job.id,
      metadata: { companyId: access.companyId, jobNumber: job.jobNumber, status: toStatus },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.company.job_status_changed",
      aggregateType: "DeliveryJob",
      aggregateId: job.id,
      payload: { companyId: access.companyId, status: toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/jobs`);
  revalidatePath(`/logistics/${access.companyId}/dispatch`);
  if (result === "not-found") return fail("That job could not be found.");
  if (result === "invalid" || result === "forbidden")
    return fail("That status change is not allowed.");
  if (result === "conflict")
    return fail("The job changed while you were working. Refresh and retry.");
  return ok("Delivery status updated.");
}

export async function verifyCompanyDeliveryOtpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = z
    .object({
      companyId: z.uuid(),
      jobId: z.uuid(),
      code: z.string().regex(/^\d{4,8}$/, "Enter the 4-8 digit code."),
    })
    .safeParse({
      companyId: formValue(formData, "companyId"),
      jobId: formValue(formData, "jobId"),
      code: formValue(formData, "code"),
    });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/jobs`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const job = await tx.deliveryJob.findFirst({
      where: {
        id: parsed.data.jobId,
        companyId: access.companyId,
        status: { in: ["AT_PICKUP", "TRANSIT"] },
      },
      select: { id: true, otpCode: true, otpExpiresAt: true, jobNumber: true },
    });
    if (!job || !job.otpCode) return "not-found" as const;
    if (isHandoverExpired(job.otpExpiresAt)) return "expired" as const;
    if (!codesMatch(job.otpCode, parsed.data.code)) return "mismatch" as const;

    await tx.deliveryProof.create({
      data: { jobId: job.id, type: "OTP", note: "Company delivery hand-over verified" },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "DELIVERY_OTP_VERIFIED",
      targetType: "DeliveryJob",
      targetId: job.id,
      metadata: { companyId: access.companyId, jobNumber: job.jobNumber },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/jobs`);
  if (result === "not-found") return fail("That job cannot be verified.");
  if (result === "expired") return fail("The hand-over code has expired.");
  if (result === "mismatch") return fail("That code does not match.");
  return ok("Hand-over code verified.");
}
