"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import { evaluateReferral, QUALIFYING_DELIVERIES, REWARD_POINTS } from "./eligibility";
import { referralSchema, registerReferralSchema, rewardStatusSchema } from "./validation";

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

export async function createReferralAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = referralSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    label: formValue(formData, "label"),
    code: formValue(formData, "code"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/referrals`,
  );
  const database = getDatabase();
  const existing = await database.partnerReferral.findUnique({
    where: { code: parsed.data.code },
    select: { id: true },
  });
  if (existing) return fail("That referral code is already in use.");

  const created = await database.$transaction(async (tx) => {
    const referral = await tx.partnerReferral.create({
      data: {
        code: parsed.data.code,
        companyId: access.companyId,
        label: parsed.data.label,
        linkPath: `/logistics/referral/${parsed.data.code}`,
        status: "ACTIVE",
        createdById: access.actorId,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARTNER_REFERRAL_CREATED",
      targetType: "PartnerReferral",
      targetId: referral.id,
      metadata: { companyId: access.companyId, code: parsed.data.code },
    });
    return referral;
  });

  revalidatePath(`/logistics/${access.companyId}/referrals`);
  return ok(`Referral ${created.id.slice(0, 8)} created.`);
}

/** Attributes a merchant to a referral, with duplicate/self-referral checks. */
export async function registerMerchantReferralAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = registerReferralSchema.safeParse({
    referralId: formValue(formData, "referralId"),
    clientId: formValue(formData, "clientId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    companyId,
    `/logistics/${companyId}/referrals`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const referral = await tx.partnerReferral.findFirst({
      where: { id: parsed.data.referralId, companyId: access.companyId, status: "ACTIVE" },
      select: { id: true, code: true },
    });
    if (!referral) return "not-found" as const;

    const client = await tx.logisticsClient.findUnique({
      where: { id: parsed.data.clientId },
      select: { id: true, verifiedAt: true, status: true },
    });
    if (!client) return "no-client" as const;

    const existingClient = await tx.partnerReferral.findUnique({
      where: { clientId: client.id },
      select: { id: true },
    });
    if (existingClient) return "duplicate" as const;

    // A merchant already linked to the referring company is not an acquisition.
    const existingRelationship = await tx.companyClientRelationship.findUnique({
      where: {
        companyId_clientId: { companyId: access.companyId, clientId: client.id },
      },
      select: { id: true, createdAt: true },
    });
    if (existingRelationship) return "self-referral" as const;

    await tx.partnerReferral.update({
      where: { id: referral.id },
      data: {
        clientId: client.id,
        status: "REGISTERED",
        registeredAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARTNER_REFERRAL_STATUS_CHANGED",
      targetType: "PartnerReferral",
      targetId: referral.id,
      metadata: { companyId: access.companyId, code: referral.code, clientId: client.id },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.referral.registered",
      aggregateType: "PartnerReferral",
      aggregateId: referral.id,
      payload: { companyId: access.companyId, clientId: client.id },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/referrals`);
  if (result === "not-found") return fail("That active referral could not be found.");
  if (result === "no-client") return fail("That merchant could not be found.");
  if (result === "duplicate") return fail("That merchant is already attributed to a referral.");
  if (result === "self-referral")
    return fail("An existing client of your company is not an acquisition.");
  return ok("Merchant attributed to the referral.");
}

/**
 * Marks a referral VERIFIED or QUALIFIED using real contract/delivery/payment data.
 * Rewards are only created for verified commercial activity.
 */
export async function advanceReferralAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = z
    .object({ referralId: z.uuid(), toStatus: z.enum(["VERIFIED", "QUALIFIED"]) })
    .safeParse({
      referralId: formValue(formData, "referralId"),
      toStatus: formValue(formData, "toStatus"),
    });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    companyId,
    `/logistics/${companyId}/referrals`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const referral = await tx.partnerReferral.findFirst({
      where: { id: parsed.data.referralId, companyId: access.companyId },
      select: { id: true, code: true, clientId: true, status: true },
    });
    if (!referral || !referral.clientId) return "not-found" as const;

    const client = await tx.logisticsClient.findUnique({
      where: { id: referral.clientId },
      select: { verifiedAt: true },
    });
    const relationships = await tx.logisticsClient.findUnique({
      where: { id: referral.clientId },
      select: {
        relationships: { select: { companyId: true, status: true } },
        contracts: {
          where: { companyId: access.companyId },
          select: {
            status: true,
            deliveries: { where: { status: "COMPLETED" }, select: { id: true } },
            invoices: { where: { status: "PAID" }, select: { id: true } },
          },
        },
      },
    });
    if (!client || !relationships) return "not-found" as const;

    const completedDeliveries = relationships.contracts.reduce(
      (sum, contract) => sum + contract.deliveries.length,
      0,
    );
    const paidInvoices = relationships.contracts.reduce(
      (sum, contract) => sum + contract.invoices.length,
      0,
    );
    const evaluation = evaluateReferral({
      clientVerified: Boolean(client.verifiedAt),
      relationshipActive: relationships.relationships.some(
        (relationship) =>
          relationship.companyId === access.companyId && relationship.status === "ACTIVE",
      ),
      completedDeliveries,
      paidInvoices,
      isSelfReferral: false,
      isDuplicateClient: false,
      referralOwnerCompanyId: access.companyId,
      clientCompanyIds: relationships.relationships.map((relationship) => relationship.companyId),
    });

    if (!evaluation.eligible) return "not-eligible" as const;
    if (parsed.data.toStatus === "QUALIFIED" && completedDeliveries < QUALIFYING_DELIVERIES) {
      return "not-qualified" as const;
    }

    const kind = parsed.data.toStatus === "VERIFIED" ? "VERIFIED_MERCHANT" : "VOLUME_50";
    const existingReward = await tx.partnerReward.findFirst({
      where: { referralId: referral.id, kind },
      select: { id: true },
    });
    if (existingReward) return "already-rewarded" as const;

    await tx.partnerReferral.update({
      where: { id: referral.id },
      data: {
        status: parsed.data.toStatus,
        verifiedAt: client.verifiedAt ?? null,
        qualifiedAt: parsed.data.toStatus === "QUALIFIED" ? new Date() : null,
      },
    });
    const reward = await tx.partnerReward.create({
      data: {
        companyId: access.companyId,
        referralId: referral.id,
        kind,
        status: "ELIGIBLE",
        currency: "TZS",
        points: REWARD_POINTS[kind as keyof typeof REWARD_POINTS],
        eligibleAt: new Date(),
      },
      select: { id: true },
    });
    await tx.partnerRewardTransaction.create({
      data: {
        rewardId: reward.id,
        kind: "CREDIT",
        points: REWARD_POINTS[kind as keyof typeof REWARD_POINTS],
        note: `Eligibility confirmed: ${completedDeliveries} deliveries, ${paidInvoices} paid invoice(s).`,
      },
    });

    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARTNER_REFERRAL_STATUS_CHANGED",
      targetType: "PartnerReferral",
      targetId: referral.id,
      metadata: {
        companyId: access.companyId,
        code: referral.code,
        status: parsed.data.toStatus,
        completedDeliveries,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARTNER_REWARD_CREATED",
      targetType: "PartnerReward",
      targetId: reward.id,
      metadata: {
        companyId: access.companyId,
        kind,
        points: REWARD_POINTS[kind as keyof typeof REWARD_POINTS],
      },
    });
    await appendOutboxEvent(tx, {
      eventType: `logistics.referral.${parsed.data.toStatus.toLowerCase()}`,
      aggregateType: "PartnerReferral",
      aggregateId: referral.id,
      payload: { companyId: access.companyId, kind },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/referrals`);
  if (result === "not-found") return fail("That attributed referral could not be found.");
  if (result === "not-eligible")
    return fail("The merchant has not met the qualifying activity requirements.");
  if (result === "not-qualified")
    return fail(`The merchant needs ${QUALIFYING_DELIVERIES} completed deliveries.`);
  if (result === "already-rewarded") return fail("A reward already exists for this milestone.");
  return ok("Referral advanced and eligible reward recorded.");
}

export async function updateRewardStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = rewardStatusSchema.safeParse({
    rewardId: formValue(formData, "rewardId"),
    toStatus: formValue(formData, "toStatus"),
    reference: formValue(formData, "reference") || undefined,
    note: formValue(formData, "note") || undefined,
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    companyId,
    `/logistics/${companyId}/referrals`,
  );
  const { rewardId, toStatus, reference, note } = parsed.data;

  if (toStatus === "PAID" && !reference) {
    return fail("A payment reference is required before marking a reward paid.");
  }

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const reward = await tx.partnerReward.findFirst({
      where: { id: rewardId, companyId: access.companyId, status: "ELIGIBLE" },
      select: { id: true },
    });
    if (!reward) return "not-found" as const;

    await tx.partnerReward.update({
      where: { id: reward.id },
      data: {
        status: toStatus,
        reference: reference ?? null,
        note: note ?? null,
        paidAt: toStatus === "PAID" ? new Date() : null,
      },
    });
    await tx.partnerRewardTransaction.create({
      data: {
        rewardId: reward.id,
        kind: toStatus,
        reference: reference ?? null,
        note: note ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "PARTNER_REWARD_STATUS_CHANGED",
      targetType: "PartnerReward",
      targetId: reward.id,
      metadata: { companyId: access.companyId, status: toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/referrals`);
  if (result === "not-found") return fail("That eligible reward could not be found.");
  return ok("Reward updated.");
}

/** Public page data for a referral link; no personal or financial data is exposed. */
export async function getPublicReferral(code: string) {
  const referral = await getDatabase().partnerReferral.findUnique({
    where: { code },
    select: {
      code: true,
      status: true,
      company: { select: { name: true, city: true, description: true } },
    },
  });
  if (!referral || referral.status !== "ACTIVE") return null;
  return {
    code: referral.code,
    companyName: referral.company.name,
    city: referral.company.city,
    description: referral.company.description,
  };
}
