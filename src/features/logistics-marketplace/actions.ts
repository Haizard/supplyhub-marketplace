"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireAdmin } from "@/server/auth/guards";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import { distanceKm, rankCompanyOffers, type CompanyOfferCandidate } from "./scoring";
import { declineSchema, offerSchema, opportunitySchema } from "./validation";

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

/** Admin publishes a marketplace delivery request as an opportunity. */
export async function createOpportunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const admin = await requireAdmin();

  const parsed = opportunitySchema.safeParse({
    requestId: formValue(formData, "requestId"),
    vehicleType: formValue(formData, "vehicleType") || undefined,
    expiresAt: formValue(formData, "expiresAt"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({
      where: { id: parsed.data.requestId },
      select: {
        id: true,
        status: true,
        requestNumber: true,
        pickupLatitude: true,
        pickupLongitude: true,
        dropoffLatitude: true,
        dropoffLongitude: true,
        distanceKm: true,
        fee: true,
        currency: true,
      },
    });
    if (!request) return { status: "not-found" as const };
    if (request.status !== "PENDING") return { status: "not-pending" as const };

    const existing = await tx.deliveryOpportunity.findFirst({
      where: {
        requestId: request.id,
        status: { in: ["OPEN", "OFFERED", "ACCEPTED", "CONVERTED"] },
      },
      select: { id: true },
    });
    if (existing) return { status: "duplicate" as const };

    const created = await tx.deliveryOpportunity.create({
      data: {
        opportunityNumber: makeDocumentNumber("OP"),
        requestId: request.id,
        status: "OPEN",
        pickupName: "Platform pickup",
        pickupAddress: "See delivery request",
        pickupLatitude: request.pickupLatitude,
        pickupLongitude: request.pickupLongitude,
        dropoffName: "Platform drop-off",
        dropoffAddress: "See delivery request",
        distanceKm: request.distanceKm,
        fee: request.fee,
        currency: request.currency,
        requiredVehicleType: parsed.data.vehicleType ?? null,
        expiresAt: parsed.data.expiresAt,
        note: parsed.data.note ?? null,
        createdById: admin.id,
      },
      select: { id: true, opportunityNumber: true },
    });

    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "DELIVERY_OPPORTUNITY_CREATED",
      targetType: "DeliveryOpportunity",
      targetId: created.id,
      metadata: {
        opportunityNumber: created.opportunityNumber,
        requestNumber: request.requestNumber,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.opportunity.created",
      aggregateType: "DeliveryOpportunity",
      aggregateId: created.id,
      payload: { opportunityNumber: created.opportunityNumber },
    });
    return { status: "ok" as const, id: created.id };
  });

  revalidatePath("/admin/logistics-marketplace");
  if (result.status === "not-found") return fail("That delivery request could not be found.");
  if (result.status === "not-pending") return fail("Only pending requests can be published.");
  if (result.status === "duplicate")
    return fail("An active opportunity already exists for that request.");
  return ok("Opportunity published for eligible companies.");
}

/** Admin ranks verified companies and offers the job to the best one. */
export async function offerOpportunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const admin = await requireAdmin();

  const parsed = offerSchema.safeParse({
    opportunityId: formValue(formData, "opportunityId"),
    companyId: formValue(formData, "companyId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const opportunity = await tx.deliveryOpportunity.findFirst({
      where: { id: parsed.data.opportunityId, status: "OPEN" },
      select: { id: true, opportunityNumber: true, expiresAt: true },
    });
    if (!opportunity) return "not-open" as const;
    if (opportunity.expiresAt <= new Date()) {
      await tx.deliveryOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "EXPIRED" },
      });
      await recordAuditEvent(tx, {
        actorId: admin.id,
        action: "DELIVERY_OPPORTUNITY_EXPIRED",
        targetType: "DeliveryOpportunity",
        targetId: opportunity.id,
        metadata: { opportunityNumber: opportunity.opportunityNumber },
      });
      return "expired" as const;
    }

    const score = await tx.logisticsCompanyOfferScore.findUnique({
      where: {
        opportunityId_companyId: {
          opportunityId: opportunity.id,
          companyId: parsed.data.companyId,
        },
      },
      select: { eligible: true },
    });
    if (!score?.eligible) return "ineligible" as const;

    await tx.logisticsCompanyOfferScore.updateMany({
      where: { opportunityId: opportunity.id },
      data: { rank: null },
    });
    await tx.logisticsCompanyOfferScore.update({
      where: {
        opportunityId_companyId: {
          opportunityId: opportunity.id,
          companyId: parsed.data.companyId,
        },
      },
      data: { rank: 1 },
    });
    await tx.deliveryOpportunity.update({
      where: { id: opportunity.id },
      data: {
        status: "OFFERED",
        offeredToId: parsed.data.companyId,
        offeredAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "DELIVERY_OPPORTUNITY_OFFERED",
      targetType: "DeliveryOpportunity",
      targetId: opportunity.id,
      metadata: {
        opportunityNumber: opportunity.opportunityNumber,
        companyId: parsed.data.companyId,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.opportunity.offered",
      aggregateType: "DeliveryOpportunity",
      aggregateId: opportunity.id,
      payload: { companyId: parsed.data.companyId },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/logistics-marketplace");
  revalidatePath(`/logistics/${parsed.data.companyId}/opportunities`);
  if (result === "not-open") return fail("That opportunity is no longer open.");
  if (result === "expired") return fail("That opportunity has expired.");
  if (result === "ineligible") return fail("Only verified, eligible companies can receive offers.");
  return ok("Opportunity offered.");
}

export async function autoOfferOpportunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const admin = await requireAdmin();

  const parsed = z.uuid().safeParse(formValue(formData, "opportunityId"));
  if (!parsed.success) return fail("Invalid opportunity.");
  const database = getDatabase();

  const opportunity = await database.deliveryOpportunity.findFirst({
    where: { id: parsed.data, status: "OPEN" },
    select: {
      id: true,
      expiresAt: true,
      pickupLatitude: true,
      pickupLongitude: true,
      requiredVehicleType: true,
    },
  });
  if (!opportunity) return fail("That opportunity is no longer open.");

  const companies = await database.logisticsCompany.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      status: true,
      city: true,
      latitude: true,
      longitude: true,
      plan: true,
      vehicles: { select: { type: true, status: true } },
      driverMemberships: {
        where: { status: "ACTIVE" },
        select: {
          jobs: {
            where: {
              status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
            },
            select: { id: true },
          },
        },
      },
      settings: { select: { defaultServiceRadius: true } },
    },
  });
  const pickup = {
    latitude: Number(opportunity.pickupLatitude.toString()),
    longitude: Number(opportunity.pickupLongitude.toString()),
  };

  const candidates: CompanyOfferCandidate[] = companies.map((company) => {
    const companyPoint =
      company.latitude && company.longitude
        ? {
            latitude: Number(company.latitude.toString()),
            longitude: Number(company.longitude.toString()),
          }
        : pickup;
    const distance = distanceKm(companyPoint, pickup);
    const radius = Number(company.settings?.defaultServiceRadius ?? 15);
    const capacityCount = Math.max(
      0,
      3 * company.driverMemberships.length -
        company.driverMemberships.reduce((sum, membership) => sum + membership.jobs.length, 0),
    );
    const vehicleMatch = company.vehicles.some(
      (vehicle) =>
        vehicle.status === "ACTIVE" &&
        (!opportunity.requiredVehicleType || vehicle.type === opportunity.requiredVehicleType),
    );
    return {
      companyId: company.id,
      verified: company.status === "APPROVED",
      active: true,
      coverageKm: company.latitude && company.longitude ? radius : null,
      distanceKm: distance,
      capacityCount,
      vehicleMatch,
      reliabilityBps: 8000,
      priceScoreBps: 8000,
    };
  });

  const ranked = rankCompanyOffers(candidates);
  const winner = ranked[0];
  if (!winner) return fail("No verified company is eligible for this opportunity.");

  const result = await database.$transaction(async (tx) => {
    await tx.logisticsCompanyOfferScore.deleteMany({ where: { opportunityId: opportunity.id } });
    if (ranked.length > 0) {
      await tx.logisticsCompanyOfferScore.createMany({
        data: ranked.map((candidate, index) => ({
          opportunityId: opportunity.id,
          companyId: candidate.companyId,
          score: decimal(candidate.score),
          coverageKm: candidate.coverageKm !== null ? decimal(candidate.coverageKm) : null,
          capacityCount: candidate.capacityCount,
          vehicleMatch: candidate.vehicleMatch,
          reliabilityBps: candidate.reliabilityBps,
          eligible: candidate.eligible,
          rank: index + 1,
        })),
      });
    }
    await tx.deliveryOpportunity.update({
      where: { id: opportunity.id },
      data: {
        status: "OFFERED",
        offeredToId: winner.companyId,
        offeredAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "DELIVERY_OPPORTUNITY_OFFERED",
      targetType: "DeliveryOpportunity",
      targetId: opportunity.id,
      metadata: { companyId: winner.companyId, score: winner.score, automatic: true },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/logistics-marketplace");
  revalidatePath(`/logistics/${winner.companyId}/opportunities`);
  void result;
  return ok(`Offered to the highest-ranked eligible company (score ${winner.score}).`);
}

export async function acceptOpportunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = offerSchema.safeParse({
    opportunityId: formValue(formData, "opportunityId"),
    companyId: formValue(formData, "companyId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/opportunities`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const opportunity = await tx.deliveryOpportunity.findFirst({
      where: {
        id: parsed.data.opportunityId,
        status: "OFFERED",
        offeredToId: access.companyId,
      },
      select: {
        id: true,
        opportunityNumber: true,
        requestId: true,
        fee: true,
        currency: true,
        expiresAt: true,
      },
    });
    if (!opportunity) return "not-found" as const;
    if (opportunity.expiresAt <= new Date()) {
      await tx.deliveryOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "EXPIRED" },
      });
      return "expired" as const;
    }

    const activeJob = await tx.deliveryJob.findFirst({
      where: {
        requestId: opportunity.requestId,
        status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] },
      },
      select: { id: true },
    });
    if (activeJob) return "already-assigned" as const;

    const job = await tx.deliveryJob.create({
      data: {
        jobNumber: makeDocumentNumber("MJ"),
        requestId: opportunity.requestId,
        companyId: access.companyId,
        status: "ASSIGNED",
      },
      select: { id: true },
    });
    await tx.deliveryRequest.update({
      where: { id: opportunity.requestId },
      data: { status: "ASSIGNED" },
    });
    await tx.deliveryOpportunity.update({
      where: { id: opportunity.id },
      data: {
        status: "ACCEPTED",
        respondedAt: new Date(),
        convertedJobId: job.id,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "DELIVERY_OPPORTUNITY_ACCEPTED",
      targetType: "DeliveryOpportunity",
      targetId: opportunity.id,
      metadata: {
        companyId: access.companyId,
        opportunityNumber: opportunity.opportunityNumber,
        jobId: job.id,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.opportunity.accepted",
      aggregateType: "DeliveryOpportunity",
      aggregateId: opportunity.id,
      payload: { companyId: access.companyId, jobId: job.id },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/logistics-marketplace");
  revalidatePath(`/logistics/${access.companyId}/opportunities`);
  revalidatePath(`/logistics/${access.companyId}/jobs`);
  if (result === "not-found") return fail("That offer could not be found.");
  if (result === "expired") return fail("That offer has expired.");
  if (result === "already-assigned") return fail("That request already has an active job.");
  return ok("Opportunity accepted and job created.");
}

export async function declineOpportunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = declineSchema.safeParse({
    opportunityId: formValue(formData, "opportunityId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    companyId,
    `/logistics/${companyId}/opportunities`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const opportunity = await tx.deliveryOpportunity.findFirst({
      where: {
        id: parsed.data.opportunityId,
        status: "OFFERED",
        offeredToId: access.companyId,
      },
      select: { id: true, opportunityNumber: true },
    });
    if (!opportunity) return "not-found" as const;

    await tx.deliveryOpportunity.update({
      where: { id: opportunity.id },
      data: {
        status: "DECLINED",
        respondedAt: new Date(),
        declineReason: parsed.data.reason,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "DELIVERY_OPPORTUNITY_DECLINED",
      targetType: "DeliveryOpportunity",
      targetId: opportunity.id,
      metadata: { companyId: access.companyId, opportunityNumber: opportunity.opportunityNumber },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/logistics-marketplace");
  revalidatePath(`/logistics/${access.companyId}/opportunities`);
  if (result === "not-found") return fail("That offer could not be found.");
  return ok("Opportunity declined. The platform can offer it to another company.");
}

export async function expireOpportunitiesAction(): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const admin = await requireAdmin();

  const database = getDatabase();
  const expired = await database.deliveryOpportunity.findMany({
    where: { status: { in: ["OPEN", "OFFERED"] }, expiresAt: { lte: new Date() } },
    select: { id: true, opportunityNumber: true },
    take: 100,
  });
  if (expired.length === 0) return ok("Nothing to expire.");

  await database.$transaction(async (tx) => {
    await tx.deliveryOpportunity.updateMany({
      where: { id: { in: expired.map((row) => row.id) } },
      data: { status: "EXPIRED" },
    });
    for (const row of expired) {
      await recordAuditEvent(tx, {
        actorId: admin.id,
        action: "DELIVERY_OPPORTUNITY_EXPIRED",
        targetType: "DeliveryOpportunity",
        targetId: row.id,
        metadata: { opportunityNumber: row.opportunityNumber },
      });
    }
  });

  revalidatePath("/admin/logistics-marketplace");
  return ok(`${expired.length} opportunity(ies) expired.`);
}
