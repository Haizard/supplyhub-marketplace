"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { DeliveryJobStatus, DeliveryRequestStatus } from "@/generated/prisma/enums";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { getSessionActor } from "@/server/auth/session";
import { requireAdmin } from "@/server/auth/guards";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { logger } from "@/lib/logging/logger";

import { pickBestAgent, haversineKm, type DispatchCandidate } from "./dispatch";
import { codesMatch, generateHandoverCode, handoverExpiry, isHandoverExpired } from "./otp";
import { calculateDeliveryFee, type PricingRule } from "./pricing";
import { canActorTransition, type JobActor } from "./status";
import {
  agentEarningPaidSchema,
  agentPresenceSchema,
  agentRegistrationSchema,
  agentReviewSchema,
  deliveryRequestSchema,
  dispatchSchema,
  documentReviewSchema,
  documentUploadSchema,
  externalDeliveryRequestSchema,
  handoverSchema,
  jobTransitionSchema,
  locationPingSchema,
  pricingRuleSchema,
  proofSchema,
} from "./validation";

const ACTIVE_JOB_STATUSES: DeliveryJobStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "TO_PICKUP",
  "AT_PICKUP",
  "TRANSIT",
];

const DEFAULT_AGENT_CAPACITY = 3;

function fail(message: string): FormState {
  return { status: "error", message };
}

function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}

function isUniqueViolation(error: unknown, target: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes(target)
  );
}

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function formatPoint(value: FormData, prefix: string) {
  return {
    latitude: formValue(value, `${prefix}.latitude`),
    longitude: formValue(value, `${prefix}.longitude`),
  };
}

async function resolvePricingRule(currency: string): Promise<PricingRule> {
  const rule = await getDatabase().deliveryPricingRule.findFirst({
    where: { currency, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  // Configurable fallback: docs/01-product-vision.md leaves pricing unresolved.
  return (
    rule ?? {
      currency,
      baseFee: new Prisma.Decimal("5000"),
      perKmRate: new Prisma.Decimal("2000"),
      minimumFee: new Prisma.Decimal("5000"),
      maximumFee: new Prisma.Decimal("50000"),
    }
  );
}

// ── Agent onboarding & administration ───────────────────────────────────────

export async function registerDeliveryAgentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to register as a courier.");

  const parsed = agentRegistrationSchema.safeParse({
    name: formValue(formData, "name"),
    phone: formValue(formData, "phone"),
    vehicleType: formValue(formData, "vehicleType"),
    plate: formValue(formData, "plate"),
    serviceAreaLabel: formValue(formData, "serviceAreaLabel"),
    latitude: formValue(formData, "latitude"),
    longitude: formValue(formData, "longitude"),
    radiusKm: formValue(formData, "radiusKm"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const existing = await database.deliveryAgent.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (existing) return fail("You already have a courier profile.");

  const agentCode = `AG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  try {
    await database.$transaction(async (transaction) => {
      const agent = await transaction.deliveryAgent.create({
        data: {
          userId: actor.id,
          agentCode,
          name: parsed.data.name,
          phone: parsed.data.phone,
          vehicle: { create: { type: parsed.data.vehicleType, plate: parsed.data.plate || "—" } },
          serviceAreas: {
            create: {
              label: parsed.data.serviceAreaLabel,
              latitude: decimal(String(parsed.data.latitude)),
              longitude: decimal(String(parsed.data.longitude)),
              radiusKm: decimal(String(parsed.data.radiusKm)),
            },
          },
          latitude: decimal(String(parsed.data.latitude)),
          longitude: decimal(String(parsed.data.longitude)),
        },
        select: { id: true },
      });
      await recordAuditEvent(transaction, {
        actorId: actor.id,
        action: "DELIVERY_AGENT_REGISTERED",
        targetType: "delivery_agent",
        targetId: agent.id,
        metadata: { agentCode },
      });
    });
  } catch (error) {
    logger.error("delivery.agent_registration_failed", { actorId: actor.id, error });
    return fail("Your courier profile could not be created. Please try again.");
  }

  revalidatePath("/courier");
  revalidatePath("/admin/delivery");
  return { status: "success", message: "Courier profile submitted for verification." };
}

export async function setAgentPresenceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to go online.");

  const parsed = agentPresenceSchema.safeParse({ presence: formValue(formData, "presence") });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const agent = await database.deliveryAgent.findUnique({
    where: { userId: actor.id },
    select: { id: true, verification: true },
  });
  if (!agent) return fail("You do not have a courier profile.");
  if (agent.verification !== "APPROVED") return fail("Your courier profile is not approved yet.");

  await database.$transaction(async (transaction) => {
    await transaction.deliveryAgent.update({
      where: { id: agent.id },
      data: { presence: parsed.data.presence },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "DELIVERY_AGENT_PRESENCE_CHANGED",
      targetType: "delivery_agent",
      targetId: agent.id,
      metadata: { presence: parsed.data.presence },
    });
  });

  revalidatePath("/courier");
  return { status: "success", message: `You are now ${parsed.data.presence.toLowerCase()}.` };
}

export async function uploadAgentDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to upload documents.");

  const parsed = documentUploadSchema.safeParse({
    agentId: formValue(formData, "agentId"),
    type: formValue(formData, "type"),
    storageKey: formValue(formData, "storageKey"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const agent = await getDatabase().deliveryAgent.findFirst({
    where: { id: parsed.data.agentId, userId: actor.id },
    select: { id: true },
  });
  if (!agent) return fail("You can only upload documents for your own profile.");

  await getDatabase().agentDocument.create({
    data: {
      agentId: agent.id,
      type: parsed.data.type,
      storageKey: parsed.data.storageKey,
    },
  });

  revalidatePath("/courier");
  revalidatePath("/admin/delivery");
  return { status: "success", message: "Document uploaded for review." };
}

export async function reviewAgentDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = documentReviewSchema.safeParse({
    documentId: formValue(formData, "documentId"),
    decision: formValue(formData, "decision"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const result = await getDatabase().$transaction(async (transaction) => {
    const document = await transaction.agentDocument.findUnique({
      where: { id: parsed.data.documentId },
      select: { id: true, agentId: true, status: true },
    });
    if (!document) return "not-found" as const;
    if (document.status !== "PENDING") return "already-reviewed" as const;

    await transaction.agentDocument.update({
      where: { id: document.id },
      data: {
        status: parsed.data.decision,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    await recordAuditEvent(transaction, {
      actorId: admin.id,
      action: "DELIVERY_AGENT_DOCUMENT_REVIEWED",
      targetType: "agent_document",
      targetId: document.id,
      metadata: { decision: parsed.data.decision, agentId: document.agentId },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/delivery");
  revalidatePath("/courier");
  if (result === "not-found") return fail("That document could not be found.");
  if (result === "already-reviewed") return fail("That document was already reviewed.");
  return { status: "success", message: "Document reviewed." };
}

export async function reviewAgentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = agentReviewSchema.safeParse({
    agentId: formValue(formData, "agentId"),
    decision: formValue(formData, "decision"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const action =
    parsed.data.decision === "APPROVED"
      ? "DELIVERY_AGENT_APPROVED"
      : parsed.data.decision === "REJECTED"
        ? "DELIVERY_AGENT_REJECTED"
        : "DELIVERY_AGENT_SUSPENDED";

  const result = await getDatabase().$transaction(async (transaction) => {
    const agent = await transaction.deliveryAgent.findUnique({
      where: { id: parsed.data.agentId },
      select: { id: true },
    });
    if (!agent) return "not-found" as const;

    await transaction.deliveryAgent.update({
      where: { id: agent.id },
      data: { verification: parsed.data.decision },
    });
    await recordAuditEvent(transaction, {
      actorId: admin.id,
      action,
      targetType: "delivery_agent",
      targetId: agent.id,
      metadata: { decision: parsed.data.decision },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/delivery");
  revalidatePath("/courier");
  return result === "ok"
    ? { status: "success", message: "Courier profile updated." }
    : fail("That courier could not be found.");
}

// ── Delivery requests ───────────────────────────────────────────────────────

function makeRequestNumber(): string {
  return `DR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createDeliveryRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to request a delivery.");

  const parsed = deliveryRequestSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    pickupName: formValue(formData, "pickupName"),
    pickupPhone: formValue(formData, "pickupPhone"),
    pickupAddress: formValue(formData, "pickupAddress"),
    pickup: formatPoint(formData, "pickup"),
    dropoffName: formValue(formData, "dropoffName"),
    dropoffPhone: formValue(formData, "dropoffPhone"),
    dropoffAddress: formValue(formData, "dropoffAddress"),
    dropoff: formatPoint(formData, "dropoff"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();

  // If tied to an order, the customer must own it.
  if (parsed.data.orderId) {
    const order = await database.order.findFirst({
      where: { id: parsed.data.orderId, customerId: actor.id },
      select: { id: true, currency: true },
    });
    if (!order) return fail("That order could not be found.");
  }

  const pickup = {
    latitude: parsed.data.pickup.latitude,
    longitude: parsed.data.pickup.longitude,
  };
  const dropoff = {
    latitude: parsed.data.dropoff.latitude,
    longitude: parsed.data.dropoff.longitude,
  };
  const distanceKm = haversineKm(pickup, dropoff);
  const rule = await resolvePricingRule("TZS");
  const { fee, currency } = calculateDeliveryFee(rule, distanceKm);
  const requestNumber = makeRequestNumber();

  await database.$transaction(async (transaction) => {
    const request = await transaction.deliveryRequest.create({
      data: {
        requestNumber,
        orderId: parsed.data.orderId ?? null,
        requesterId: actor.id,
        pickupName: parsed.data.pickupName,
        pickupPhone: parsed.data.pickupPhone ?? null,
        pickupAddress: parsed.data.pickupAddress,
        pickupLatitude: decimal(String(pickup.latitude)),
        pickupLongitude: decimal(String(pickup.longitude)),
        dropoffName: parsed.data.dropoffName,
        dropoffPhone: parsed.data.dropoffPhone ?? null,
        dropoffAddress: parsed.data.dropoffAddress,
        dropoffLatitude: decimal(String(dropoff.latitude)),
        dropoffLongitude: decimal(String(dropoff.longitude)),
        distanceKm: decimal(distanceKm.toFixed(3)),
        fee: decimal(fee),
        currency,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "DELIVERY_REQUEST_CREATED",
      targetType: "delivery_request",
      targetId: request.id,
      metadata: { requestNumber, distanceKm: distanceKm.toFixed(3) },
    });
  });

  revalidatePath("/delivery");
  revalidatePath("/admin/delivery");
  return {
    status: "success",
    message: `Delivery ${requestNumber} requested. An available courier will be assigned.`,
  };
}

/** Idempotent external API action used by the route handler. */
export async function createExternalDeliveryRequest(input: {
  externalRef: string;
  businessId?: string;
  requesterId: string;
  pickupName: string;
  pickupPhone?: string;
  pickupAddress: string;
  pickup: { latitude: number; longitude: number };
  dropoffName: string;
  dropoffPhone?: string;
  dropoffAddress: string;
  dropoff: { latitude: number; longitude: number };
  currency: string;
  note?: string;
}): Promise<{ ok: true; requestId: string; requestNumber: string } | { ok: false; error: string }> {
  const parsed = externalDeliveryRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request body." };

  const database = getDatabase();
  const existing = await database.deliveryRequest.findUnique({
    where: { externalRef: parsed.data.externalRef },
    select: { id: true, requestNumber: true },
  });
  if (existing) return { ok: true, requestId: existing.id, requestNumber: existing.requestNumber };

  const distanceKm = haversineKm(parsed.data.pickup, parsed.data.dropoff);
  const rule = await resolvePricingRule(parsed.data.currency);
  const { fee, currency } = calculateDeliveryFee(rule, distanceKm);
  const requestNumber = makeRequestNumber();

  try {
    const created = await database.$transaction(async (transaction) => {
      const request = await transaction.deliveryRequest.create({
        data: {
          requestNumber,
          externalRef: parsed.data.externalRef,
          businessId: parsed.data.businessId ?? null,
          requesterId: input.requesterId,
          pickupName: parsed.data.pickupName,
          pickupPhone: parsed.data.pickupPhone ?? null,
          pickupAddress: parsed.data.pickupAddress,
          pickupLatitude: decimal(String(parsed.data.pickup.latitude)),
          pickupLongitude: decimal(String(parsed.data.pickup.longitude)),
          dropoffName: parsed.data.dropoffName,
          dropoffPhone: parsed.data.dropoffPhone ?? null,
          dropoffAddress: parsed.data.dropoffAddress,
          dropoffLatitude: decimal(String(parsed.data.dropoff.latitude)),
          dropoffLongitude: decimal(String(parsed.data.dropoff.longitude)),
          distanceKm: decimal(distanceKm.toFixed(3)),
          fee: decimal(fee),
          currency,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });
      await recordAuditEvent(transaction, {
        actorId: input.requesterId,
        action: "DELIVERY_REQUEST_CREATED",
        targetType: "delivery_request",
        targetId: request.id,
        metadata: { requestNumber, external: true },
      });
      return request;
    });
    return { ok: true, requestId: created.id, requestNumber };
  } catch (error) {
    if (isUniqueViolation(error, "external_ref")) {
      const raced = await database.deliveryRequest.findUnique({
        where: { externalRef: parsed.data.externalRef },
        select: { id: true, requestNumber: true },
      });
      if (raced) return { ok: true, requestId: raced.id, requestNumber: raced.requestNumber };
    }
    logger.error("delivery.external_request_failed", { error });
    return { ok: false, error: "The delivery request could not be created." };
  }
}

export async function cancelDeliveryRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to cancel a delivery.");
  const requestId = z.uuid().safeParse(formValue(formData, "requestId"));
  if (!requestId.success) return fail("That delivery request could not be found.");

  const result = await getDatabase().$transaction(async (transaction) => {
    const request = await transaction.deliveryRequest.findFirst({
      where: {
        id: requestId.data,
        requesterId: actor.id,
        status: { in: ["PENDING", "ASSIGNED"] },
      },
      select: { id: true, requestNumber: true, status: true },
    });
    if (!request) return "not-found" as const;
    if (request.status === "ASSIGNED") {
      const active = await transaction.deliveryJob.count({
        where: { requestId: request.id, status: { in: ACTIVE_JOB_STATUSES } },
      });
      if (active > 0) return "has-active-job" as const;
    }
    await transaction.deliveryRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "DELIVERY_REQUEST_CANCELLED",
      targetType: "delivery_request",
      targetId: request.id,
      metadata: { requestNumber: request.requestNumber },
    });
    return "ok" as const;
  });

  revalidatePath("/delivery");
  revalidatePath("/admin/delivery");
  if (result === "not-found") return fail("That request is no longer cancellable.");
  if (result === "has-active-job") return fail("Cancel the active delivery job first.");
  return { status: "success", message: "Delivery request cancelled." };
}

// ── Dispatch & lifecycle ────────────────────────────────────────────────────

export async function dispatchDeliveryAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = dispatchSchema.safeParse({ requestId: formValue(formData, "requestId") });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const request = await database.deliveryRequest.findUnique({
    where: { id: parsed.data.requestId },
    select: {
      id: true,
      status: true,
      requestNumber: true,
      pickupLatitude: true,
      pickupLongitude: true,
    },
  });
  if (!request) return fail("That request could not be found.");
  if (request.status !== "PENDING") return fail("Only pending requests can be dispatched.");

  const existingJob = await database.deliveryJob.findFirst({
    where: { requestId: request.id, status: { in: ACTIVE_JOB_STATUSES } },
    select: { id: true },
  });
  if (existingJob) return fail("This request already has an active delivery job.");

  const candidates = await database.deliveryAgent.findMany({
    where: { verification: "APPROVED", presence: "ONLINE" },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      rating: true,
      completedTrips: true,
      serviceAreas: { select: { latitude: true, longitude: true, radiusKm: true } },
      currentJobs: {
        where: { status: { in: ACTIVE_JOB_STATUSES } },
        select: { id: true },
      },
    },
  });

  const pickup = {
    latitude: Number(request.pickupLatitude.toString()),
    longitude: Number(request.pickupLongitude.toString()),
  };

  const scored: DispatchCandidate[] = candidates.map((agent) => {
    const agentLat = agent.latitude ? Number(agent.latitude.toString()) : pickup.latitude;
    const agentLng = agent.longitude ? Number(agent.longitude.toString()) : pickup.longitude;
    const inServiceArea = agent.serviceAreas.some(
      (area) =>
        haversineKm(pickup, {
          latitude: Number(area.latitude.toString()),
          longitude: Number(area.longitude.toString()),
        }) <= Number(area.radiusKm.toString()),
    );
    return {
      agentId: agent.id,
      distanceKm: haversineKm({ latitude: agentLat, longitude: agentLng }, pickup),
      rating: Number(agent.rating.toString()),
      completedTrips: agent.completedTrips,
      inServiceArea,
      capacity: DEFAULT_AGENT_CAPACITY,
      activeJobs: agent.currentJobs.length,
    };
  });

  const winner = pickBestAgent(scored);
  if (!winner) return fail("No verified courier is online and available right now.");

  const jobNumber = `DJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await database.$transaction(async (transaction) => {
    const job = await transaction.deliveryJob.create({
      data: {
        jobNumber,
        requestId: request.id,
        agentId: winner.agentId,
        status: "ASSIGNED",
        otpCode: generateHandoverCode(),
        otpExpiresAt: handoverExpiry(),
        assignments: {
          create: {
            agentId: winner.agentId,
            score: decimal(winner.score.toFixed(3)),
          },
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "ASSIGNED",
            actorId: admin.id,
            note: `Assigned by dispatch (score ${winner.score}).`,
          },
        },
      },
      select: { id: true },
    });
    await transaction.deliveryRequest.update({
      where: { id: request.id },
      data: { status: "ASSIGNED" },
    });
    await recordAuditEvent(transaction, {
      actorId: admin.id,
      action: "DELIVERY_JOB_ASSIGNED",
      targetType: "delivery_job",
      targetId: job.id,
      metadata: { jobNumber, agentId: winner.agentId, score: winner.score },
    });
  });

  revalidatePath("/admin/delivery");
  revalidatePath("/courier");
  revalidatePath("/delivery");
  return { status: "success", message: `Job ${jobNumber} dispatched to a courier.` };
}

/**
 * Moves a job along the lifecycle. `actor` is derived from the session on the
 * server — never supplied by the client.
 */
async function transitionJob(formData: FormData, actorKind: JobActor): Promise<FormState> {
  const parsed = jobTransitionSchema.safeParse({
    jobId: formValue(formData, "jobId"),
    toStatus: formValue(formData, "toStatus"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to update a delivery.");

  const result = await database.$transaction(async (transaction) => {
    const job = await transaction.deliveryJob.findUnique({
      where: { id: parsed.data.jobId },
      select: {
        id: true,
        jobNumber: true,
        agentId: true,
        status: true,
        request: {
          select: {
            id: true,
            requesterId: true,
            fee: true,
            currency: true,
          },
        },
      },
    });
    if (!job) return "not-found" as const;

    // Authorization: derive what this actor may do from the job itself.
    let allowed = false;
    if (actorKind === "agent") {
      allowed =
        job.agentId !== null &&
        (await transaction.deliveryAgent.findFirst({
          where: { id: job.agentId, userId: actor.id },
          select: { id: true },
        })) !== null;
    } else if (actorKind === "requester") {
      allowed = job.request.requesterId === actor.id;
    } else {
      allowed = actor.role === "ADMIN";
    }
    if (!allowed) return "forbidden" as const;

    const target = parsed.data.toStatus as DeliveryJobStatus;
    if (!canActorTransition(job.status, target, actorKind)) return "invalid-transition" as const;

    const now = new Date();
    const stampField: Partial<Prisma.DeliveryJobUpdateInput> =
      target === "ACCEPTED"
        ? { acceptedAt: now }
        : target === "TO_PICKUP"
          ? { pickedUpAt: now }
          : target === "DELIVERED"
            ? { deliveredAt: now }
            : target === "CANCELLED"
              ? { cancelledAt: now }
              : {};

    // Optimistic concurrency: only update if the status is still what we read.
    const updated = await transaction.deliveryJob.updateMany({
      where: { id: job.id, status: job.status },
      data: {
        status: target,
        ...stampField,
        ...(target === "DELIVERED" ? { otpCode: null, otpExpiresAt: null } : {}),
      },
    });
    if (updated.count === 0) return "conflict" as const;

    await transaction.deliveryStatusHistory.create({
      data: {
        jobId: job.id,
        fromStatus: job.status,
        toStatus: target,
        actorId: actor.id,
        note: parsed.data.note ?? null,
      },
    });

    if (target === "DELIVERED") {
      // Commission and earning are immutable once written; one per job.
      const fee = Number(job.request.fee.toString());
      const commissionRateBps = 1500; // documented configurable default
      const commissionAmount = (Math.round(fee * commissionRateBps) / 10000).toFixed(2);
      const earningAmount = (Math.round((fee - Number(commissionAmount)) * 100) / 100).toFixed(2);

      await transaction.deliveryCommission.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          amount: decimal(commissionAmount),
          currency: job.request.currency,
          rateBps: commissionRateBps,
        },
        update: {},
      });
      await transaction.agentEarning.upsert({
        where: { jobId: job.id },
        create: {
          agentId: job.agentId!,
          jobId: job.id,
          amount: decimal(earningAmount),
          currency: job.request.currency,
        },
        update: {},
      });
      await transaction.deliveryAgent.update({
        where: { id: job.agentId! },
        data: {
          completedTrips: { increment: 1 },
          ...(job.status === "DELIVERED" ? {} : {}),
        },
      });
      if (actorKind === "admin") {
        await transaction.deliveryRequest.updateMany({
          where: { id: job.request.id, status: "ASSIGNED" },
          data: { status: "COMPLETED" },
        });
      }
    }

    if (target === "CANCELLED") {
      await transaction.deliveryRequest.updateMany({
        where: { id: job.request.id, status: "ASSIGNED" },
        data: { status: "CANCELLED" },
      });
    }

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "DELIVERY_JOB_STATUS_CHANGED",
      targetType: "delivery_job",
      targetId: job.id,
      metadata: { jobNumber: job.jobNumber, from: job.status, to: target },
    });
    return "ok" as const;
  });

  revalidatePath("/courier");
  revalidatePath("/delivery");
  revalidatePath("/admin/delivery");

  if (result === "not-found") return fail("That job could not be found.");
  if (result === "forbidden") return fail("You cannot update this delivery.");
  if (result === "invalid-transition")
    return fail("That delivery cannot move to the requested state.");
  if (result === "conflict")
    return fail("This delivery changed while you were updating it. Try again.");
  return { status: "success", message: "Delivery updated." };
}

export async function agentTransitionJobAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return transitionJob(formData, "agent");
}

export async function requesterTransitionJobAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return transitionJob(formData, "requester");
}

export async function adminTransitionJobAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return transitionJob(formData, "admin");
}

// ── Tracking, proof and earnings ────────────────────────────────────────────

export async function pingLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to share your location.");

  const parsed = locationPingSchema.safeParse({
    jobId: formValue(formData, "jobId"),
    latitude: formValue(formData, "latitude"),
    longitude: formValue(formData, "longitude"),
    heading: formValue(formData, "heading"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const agent = await database.deliveryAgent.findFirst({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!agent) return fail("You do not have a courier profile.");

  const job = await database.deliveryJob.findFirst({
    where: { id: parsed.data.jobId, agentId: agent.id, status: { in: ACTIVE_JOB_STATUSES } },
    select: { id: true },
  });
  if (!job) return fail("You are not on this delivery.");

  await database.$transaction([
    database.deliveryLocation.create({
      data: {
        jobId: job.id,
        agentId: agent.id,
        latitude: decimal(String(parsed.data.latitude)),
        longitude: decimal(String(parsed.data.longitude)),
        heading: parsed.data.heading !== undefined ? decimal(String(parsed.data.heading)) : null,
      },
    }),
    database.deliveryAgent.update({
      where: { id: agent.id },
      data: {
        latitude: decimal(String(parsed.data.latitude)),
        longitude: decimal(String(parsed.data.longitude)),
      },
    }),
  ]);

  revalidatePath(`/delivery/track/${job.id}`);
  return { status: "success", message: "Location updated." };
}

export async function verifyHandoverAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to confirm hand-over.");

  const parsed = handoverSchema.safeParse({
    jobId: formValue(formData, "jobId"),
    code: formValue(formData, "code"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const agent = await database.deliveryAgent.findFirst({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!agent) return fail("You do not have a courier profile.");

  const job = await database.deliveryJob.findFirst({
    where: {
      id: parsed.data.jobId,
      agentId: agent.id,
      status: { in: ["AT_PICKUP", "TRANSIT"] },
    },
    select: { id: true, jobNumber: true, otpCode: true, otpExpiresAt: true },
  });
  if (!job) return fail("That delivery is not ready for hand-over.");

  if (isHandoverExpired(job.otpExpiresAt)) return fail("The hand-over code has expired.");
  if (!codesMatch(job.otpCode, parsed.data.code)) return fail("That hand-over code is incorrect.");

  // OTP confirmation is a proof record; the status move is a separate, explicit
  // action so an admin can still drive the lifecycle if needed.
  await database.$transaction(async (transaction) => {
    await transaction.deliveryProof.create({
      data: { jobId: job.id, type: "OTP", note: "Code verified at hand-over." },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "DELIVERY_OTP_VERIFIED",
      targetType: "delivery_job",
      targetId: job.id,
      metadata: { jobNumber: job.jobNumber },
    });
  });

  revalidatePath("/courier");
  revalidatePath("/delivery");
  return { status: "success", message: "Hand-over code verified." };
}

export async function recordProofAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to record proof of delivery.");

  const parsed = proofSchema.safeParse({
    jobId: formValue(formData, "jobId"),
    type: formValue(formData, "type"),
    storageKey: formValue(formData, "storageKey"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const agent = await database.deliveryAgent.findFirst({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!agent) return fail("You do not have a courier profile.");

  const job = await database.deliveryJob.findFirst({
    where: { id: parsed.data.jobId, agentId: agent.id },
    select: { id: true, jobNumber: true },
  });
  if (!job) return fail("You are not assigned to this delivery.");

  await database.$transaction(async (transaction) => {
    await transaction.deliveryProof.create({
      data: {
        jobId: job.id,
        type: parsed.data.type,
        storageKey: parsed.data.storageKey ?? null,
        note: parsed.data.note ?? null,
      },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "DELIVERY_PROOF_RECORDED",
      targetType: "delivery_job",
      targetId: job.id,
      metadata: { jobNumber: job.jobNumber, type: parsed.data.type },
    });
  });

  revalidatePath("/courier");
  revalidatePath("/delivery");
  return { status: "success", message: "Proof of delivery recorded." };
}

export async function payAgentEarningAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = agentEarningPaidSchema.safeParse({ earningId: formValue(formData, "earningId") });
  if (!parsed.success) return failFields(parsed.error);

  const result = await getDatabase().$transaction(async (transaction) => {
    const earning = await transaction.agentEarning.findUnique({
      where: { id: parsed.data.earningId },
      select: { id: true, status: true, job: { select: { jobNumber: true } } },
    });
    if (!earning) return "not-found" as const;
    if (earning.status !== "PENDING") return "already-paid" as const;
    await transaction.agentEarning.update({
      where: { id: earning.id },
      data: { status: "PAID", paidAt: new Date() },
    });
    await recordAuditEvent(transaction, {
      actorId: admin.id,
      action: "DELIVERY_EARNING_PAID",
      targetType: "agent_earning",
      targetId: earning.id,
      metadata: { jobNumber: earning.job.jobNumber },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/delivery");
  revalidatePath("/courier");
  if (result === "not-found") return fail("That earning could not be found.");
  if (result === "already-paid") return fail("That earning was already paid.");
  return { status: "success", message: "Courier earning marked as paid." };
}

export async function savePricingRuleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = pricingRuleSchema.safeParse({
    currency: formValue(formData, "currency"),
    baseFee: formValue(formData, "baseFee"),
    perKmRate: formValue(formData, "perKmRate"),
    minimumFee: formValue(formData, "minimumFee"),
    maximumFee: formValue(formData, "maximumFee"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  await database.$transaction(async (transaction) => {
    await transaction.deliveryPricingRule.updateMany({
      where: { currency: parsed.data.currency, isActive: true },
      data: { isActive: false },
    });
    await transaction.deliveryPricingRule.create({
      data: {
        name: `${parsed.data.currency} default`,
        currency: parsed.data.currency,
        baseFee: decimal(parsed.data.baseFee.toFixed(2)),
        perKmRate: decimal(parsed.data.perKmRate.toFixed(2)),
        minimumFee: decimal(parsed.data.minimumFee.toFixed(2)),
        maximumFee:
          parsed.data.maximumFee !== undefined ? decimal(parsed.data.maximumFee.toFixed(2)) : null,
      },
    });
    await recordAuditEvent(transaction, {
      actorId: admin.id,
      action: "DELIVERY_PRICING_UPDATED",
      targetType: "delivery_pricing_rule",
      targetId: "currency:" + parsed.data.currency,
      metadata: { currency: parsed.data.currency },
    });
  });

  revalidatePath("/admin/delivery");
  return { status: "success", message: "Delivery pricing updated." };
}

// ── Studio-facing request creation (uses business permission) ───────────────

export async function createStudioDeliveryRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireStudioAccess("delivery.request.create", "/vendor/orders");
  const actor = access.actor;

  const parsed = deliveryRequestSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    pickupName: formValue(formData, "pickupName"),
    pickupPhone: formValue(formData, "pickupPhone"),
    pickupAddress: formValue(formData, "pickupAddress"),
    pickup: formatPoint(formData, "pickup"),
    dropoffName: formValue(formData, "dropoffName"),
    dropoffPhone: formValue(formData, "dropoffPhone"),
    dropoffAddress: formValue(formData, "dropoffAddress"),
    dropoff: formatPoint(formData, "dropoff"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  if (parsed.data.orderId) {
    const vendorOrder = await database.vendorOrder.findFirst({
      where: { id: parsed.data.orderId, vendorId: access.vendorId },
      select: { id: true },
    });
    if (!vendorOrder) return fail("That studio order could not be found.");
    // Reuse the customer order id that owns the vendor order.
    const parent = await database.vendorOrder.findUnique({
      where: { id: vendorOrder.id },
      select: { orderId: true },
    });
    parsed.data.orderId = parent?.orderId ?? undefined;
  }

  const pickup = parsed.data.pickup;
  const dropoff = parsed.data.dropoff;
  const distanceKm = haversineKm(pickup, dropoff);
  const rule = await resolvePricingRule("TZS");
  const { fee, currency } = calculateDeliveryFee(rule, distanceKm);
  const requestNumber = makeRequestNumber();

  await database.$transaction(async (transaction) => {
    const request = await transaction.deliveryRequest.create({
      data: {
        requestNumber,
        orderId: parsed.data.orderId ?? null,
        businessId: access.businessId,
        requesterId: actor.id,
        pickupName: parsed.data.pickupName,
        pickupPhone: parsed.data.pickupPhone ?? null,
        pickupAddress: parsed.data.pickupAddress,
        pickupLatitude: decimal(String(pickup.latitude)),
        pickupLongitude: decimal(String(pickup.longitude)),
        dropoffName: parsed.data.dropoffName,
        dropoffPhone: parsed.data.dropoffPhone ?? null,
        dropoffAddress: parsed.data.dropoffAddress,
        dropoffLatitude: decimal(String(dropoff.latitude)),
        dropoffLongitude: decimal(String(dropoff.longitude)),
        distanceKm: decimal(distanceKm.toFixed(3)),
        fee: decimal(fee),
        currency,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "DELIVERY_REQUEST_CREATED",
      targetType: "delivery_request",
      targetId: request.id,
      metadata: { requestNumber, vendorId: access.vendorId },
    });
  });

  revalidatePath("/vendor/orders");
  revalidatePath("/admin/delivery");
  return { status: "success", message: `Delivery ${requestNumber} requested.` };
}

export type { DeliveryRequestStatus };
