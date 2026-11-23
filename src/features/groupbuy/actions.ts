"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { centsToDecimalString } from "@/features/catalog/money";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";
import { isFeatureEnabled } from "@/features/flags/service";
import { logger } from "@/lib/logging/logger";

import { canTransitionCampaign } from "./status";
import { resolveTierPriceForQuantity } from "./queries";
import { campaignSchema, participationSchema, campaignStatusSchema } from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}
function decimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(centsToDecimalString(cents));
}

interface TierFormInput {
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
}

function readTiers(formData: FormData): TierFormInput[] {
  const raw = formValue(formData, "tiers");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TierFormInput[]) : [];
  } catch {
    return [];
  }
}

// ── Campaign create / update (vendor side) ─────────────────────────────────

export async function saveCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.groupBuying"))) {
    return fail("Group buying is not available yet.");
  }

  const access = await requireStudioAccess("groupbuy.manage", "/vendor/group-buy");

  const tiers = readTiers(formData);
  const parsed = campaignSchema.safeParse({
    campaignId: formValue(formData, "campaignId"),
    vendorId: formValue(formData, "vendorId"),
    productId: formValue(formData, "productId"),
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    currency: formValue(formData, "currency"),
    basePrice: formValue(formData, "basePrice"),
    targetQuantity: formValue(formData, "targetQuantity"),
    maxQuantity: formValue(formData, "maxQuantity"),
    startsAt: formValue(formData, "startsAt"),
    endsAt: formValue(formData, "endsAt"),
    tiers,
  });
  if (!parsed.success) return failFields(parsed.error);

  // The vendor id is always derived from the session, never from the client.
  if (parsed.data.vendorId !== access.vendorId) {
    return fail("You can only manage your own campaigns.");
  }

  const database = getDatabase();
  const data = parsed.data;
  const isEdit = Boolean(data.campaignId);

  if (isEdit) {
    const existing = await database.groupBuyCampaign.findFirst({
      where: { id: data.campaignId!, vendorId: access.vendorId },
      select: { id: true, status: true },
    });
    if (!existing) return fail("That campaign could not be found.");
    if (existing.status !== "DRAFT") {
      return fail("Only draft campaigns can be edited.");
    }
  }

  const campaignNumber = isEdit ? "" : makeDocumentNumber("GB");
  let campaignId = data.campaignId ?? "";

  try {
    await database.$transaction(async (tx) => {
      if (isEdit) {
        await tx.groupBuyCampaign.update({
          where: { id: campaignId },
          data: {
            productId: data.productId ?? null,
            title: data.title,
            description: data.description ?? "",
            currency: data.currency,
            basePrice: decimal(data.basePrice),
            targetQuantity: data.targetQuantity,
            maxQuantity: data.maxQuantity ?? null,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
          },
        });
        await tx.groupBuyTier.deleteMany({ where: { campaignId } });
      } else {
        const created = await tx.groupBuyCampaign.create({
          data: {
            campaignNumber,
            vendorId: access.vendorId,
            businessId: access.businessId,
            productId: data.productId ?? null,
            title: data.title,
            description: data.description ?? "",
            currency: data.currency,
            basePrice: decimal(data.basePrice),
            targetQuantity: data.targetQuantity,
            maxQuantity: data.maxQuantity ?? null,
            status: "DRAFT",
            startsAt: data.startsAt,
            endsAt: data.endsAt,
          },
          select: { id: true },
        });
        campaignId = created.id;
      }

      if (data.tiers.length > 0) {
        await tx.groupBuyTier.createMany({
          data: data.tiers.map((tier) => ({
            campaignId,
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity ?? null,
            unitPrice: decimal(tier.unitPrice),
          })),
        });
      }

      await recordAuditEvent(tx, {
        actorId: access.actor.id,
        action: isEdit ? "GROUP_BUY_CAMPAIGN_UPDATED" : "GROUP_BUY_CAMPAIGN_CREATED",
        targetType: "GroupBuyCampaign",
        targetId: campaignId,
        metadata: { campaignNumber: campaignNumber || undefined, title: data.title },
      });

      await appendOutboxEvent(tx, {
        eventType: isEdit ? "group_buy.campaign.updated" : "group_buy.campaign.created",
        aggregateType: "GroupBuyCampaign",
        aggregateId: campaignId,
        payload: { campaignNumber: campaignNumber || undefined, vendorId: access.vendorId },
      });
    });
  } catch (error) {
    logger.error("groupbuy.campaign_save_failed", { actorId: access.actor.id, error });
    return fail("The campaign could not be saved.");
  }

  revalidatePath("/vendor/group-buy");
  revalidatePath("/group-buy");
  return ok(isEdit ? "Campaign updated." : "Campaign created.");
}

// ── Campaign activate (DRAFT → ACTIVE) ─────────────────────────────────────

export async function activateCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.groupBuying"))) {
    return fail("Group buying is not available yet.");
  }

  const access = await requireStudioAccess("groupbuy.manage", "/vendor/group-buy");
  const parsed = campaignStatusSchema.safeParse({
    id: formValue(formData, "campaignId"),
    toStatus: "ACTIVE",
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const campaign = await tx.groupBuyCampaign.findFirst({
      where: { id: parsed.data.id, vendorId: access.vendorId },
      select: { id: true, campaignNumber: true, status: true },
    });
    if (!campaign) return "not-found" as const;
    if (!canTransitionCampaign(campaign.status, "ACTIVE")) {
      return "invalid-transition" as const;
    }

    await tx.groupBuyCampaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE" },
    });

    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: "GROUP_BUY_CAMPAIGN_UPDATED",
      targetType: "GroupBuyCampaign",
      targetId: campaign.id,
      metadata: { campaignNumber: campaign.campaignNumber, toStatus: "ACTIVE" },
    });

    await appendOutboxEvent(tx, {
      eventType: "group_buy.campaign.activated",
      aggregateType: "GroupBuyCampaign",
      aggregateId: campaign.id,
      payload: { campaignNumber: campaign.campaignNumber },
    });

    return "ok" as const;
  });

  revalidatePath("/vendor/group-buy");
  revalidatePath("/group-buy");
  if (result === "not-found") return fail("That campaign could not be found.");
  if (result === "invalid-transition") return fail("Only draft campaigns can be activated.");
  return ok("Campaign is now live.");
}

// ── Campaign cancel (DRAFT or ACTIVE → CANCELLED) ──────────────────────────

export async function cancelCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.groupBuying"))) {
    return fail("Group buying is not available yet.");
  }

  const access = await requireStudioAccess("groupbuy.manage", "/vendor/group-buy");
  const parsed = campaignStatusSchema.safeParse({
    id: formValue(formData, "campaignId"),
    toStatus: "CANCELLED",
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const campaign = await tx.groupBuyCampaign.findFirst({
      where: { id: parsed.data.id, vendorId: access.vendorId },
      select: { id: true, campaignNumber: true, status: true },
    });
    if (!campaign) return "not-found" as const;
    if (!canTransitionCampaign(campaign.status, "CANCELLED")) {
      return "invalid-transition" as const;
    }

    await tx.groupBuyCampaign.update({
      where: { id: campaign.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: "GROUP_BUY_CAMPAIGN_CANCELLED",
      targetType: "GroupBuyCampaign",
      targetId: campaign.id,
      metadata: { campaignNumber: campaign.campaignNumber },
    });

    await appendOutboxEvent(tx, {
      eventType: "group_buy.campaign.cancelled",
      aggregateType: "GroupBuyCampaign",
      aggregateId: campaign.id,
      payload: { campaignNumber: campaign.campaignNumber },
    });

    return "ok" as const;
  });

  revalidatePath("/vendor/group-buy");
  revalidatePath("/group-buy");
  if (result === "not-found") return fail("That campaign could not be found.");
  if (result === "invalid-transition") return fail("This campaign can no longer be cancelled.");
  return ok("Campaign cancelled.");
}

// ── Buyer join ─────────────────────────────────────────────────────────────

export async function joinCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.groupBuying"))) {
    return fail("Group buying is not available yet.");
  }

  const actor = await requireActor("/group-buy");
  const parsed = participationSchema.safeParse({
    campaignId: formValue(formData, "campaignId"),
    quantity: formValue(formData, "quantity"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();

  try {
    const result = await database.$transaction(async (tx) => {
      const campaign = await tx.groupBuyCampaign.findUnique({
        where: { id: parsed.data.campaignId },
        select: {
          id: true,
          campaignNumber: true,
          vendorId: true,
          currency: true,
          basePrice: true,
          targetQuantity: true,
          maxQuantity: true,
          status: true,
          tiers: {
            orderBy: { minQuantity: "asc" },
            select: { id: true, minQuantity: true, maxQuantity: true, unitPrice: true },
          },
          participations: { select: { buyerId: true, quantity: true } },
        },
      });

      if (!campaign) return "not-found" as const;
      if (campaign.status !== "ACTIVE") {
        return "not-active" as const;
      }

      // Prevent double-join (unique constraint on [campaignId, buyerId]).
      const alreadyJoined = campaign.participations.some((p) => p.buyerId === actor.id);
      if (alreadyJoined) return "already-joined" as const;

      // Check max quantity cap.
      const currentTotal = campaign.participations.reduce((sum, p) => sum + p.quantity, 0);
      const newTotal = currentTotal + parsed.data.quantity;
      if (campaign.maxQuantity !== null && newTotal > campaign.maxQuantity) {
        return "exceeds-max" as const;
      }

      // Resolve tier price based on cumulative quantity after joining.
      const tiers = campaign.tiers.map((t) => ({
        id: t.id,
        minQuantity: t.minQuantity,
        maxQuantity: t.maxQuantity,
        unitPrice: t.unitPrice.toString(),
      }));
      const resolvedPrice = resolveTierPriceForQuantity(
        Math.max(newTotal, 1),
        campaign.basePrice.toString(),
        tiers,
      );

      // Create participation.
      await tx.groupBuyParticipation.create({
        data: {
          campaignId: campaign.id,
          buyerId: actor.id,
          quantity: parsed.data.quantity,
          currency: campaign.currency,
          reservedPrice: new Prisma.Decimal(resolvedPrice),
          status: "JOINED",
        },
      });

      await recordAuditEvent(tx, {
        actorId: actor.id,
        action: "GROUP_BUY_JOINED",
        targetType: "GroupBuyCampaign",
        targetId: campaign.id,
        metadata: {
          campaignNumber: campaign.campaignNumber,
          quantity: parsed.data.quantity,
          reservedPrice: resolvedPrice,
        },
      });

      await appendOutboxEvent(tx, {
        eventType: "group_buy.participation.joined",
        aggregateType: "GroupBuyParticipation",
        aggregateId: campaign.id,
        payload: {
          campaignId: campaign.id,
          buyerId: actor.id,
          quantity: parsed.data.quantity,
          reservedPrice: resolvedPrice,
        },
      });

      // Auto-transition to FUNDED if target reached.
      if (newTotal >= campaign.targetQuantity) {
        await tx.groupBuyCampaign.update({
          where: { id: campaign.id },
          data: { status: "FUNDED", fundedAt: new Date() },
        });

        await recordAuditEvent(tx, {
          actorId: actor.id,
          action: "GROUP_BUY_CAMPAIGN_FUNDED",
          targetType: "GroupBuyCampaign",
          targetId: campaign.id,
          metadata: {
            campaignNumber: campaign.campaignNumber,
            totalQuantity: newTotal,
            targetQuantity: campaign.targetQuantity,
          },
        });

        await appendOutboxEvent(tx, {
          eventType: "group_buy.campaign.funded",
          aggregateType: "GroupBuyCampaign",
          aggregateId: campaign.id,
          payload: {
            campaignNumber: campaign.campaignNumber,
            totalQuantity: newTotal,
          },
        });
      }

      return "ok" as const;
    });

    revalidatePath("/group-buy");
    revalidatePath(`/group-buy/${parsed.data.campaignId}`);
    revalidatePath("/account");

    if (result === "not-found") return fail("That campaign could not be found.");
    if (result === "not-active") return fail("This campaign is not accepting new participants.");
    if (result === "already-joined") return fail("You have already joined this campaign.");
    if (result === "exceeds-max")
      return fail("Your quantity exceeds the remaining capacity of this campaign.");

    return ok("You joined the campaign.");
  } catch (error) {
    // Handle Prisma unique constraint violation (P2002) for double-join race.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("You have already joined this campaign.");
    }
    logger.error("groupbuy.join_failed", { actorId: actor.id, error });
    return fail("Could not join the campaign. Please try again.");
  }
}

// ── Buyer leave (ACTIVE only) ──────────────────────────────────────────────

export async function leaveCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.groupBuying"))) {
    return fail("Group buying is not available yet.");
  }

  const actor = await requireActor("/group-buy");
  const parsed = participationSchema.safeParse({
    campaignId: formValue(formData, "campaignId"),
    quantity: formValue(formData, "quantity"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const participation = await tx.groupBuyParticipation.findUnique({
      where: {
        campaignId_buyerId: {
          campaignId: parsed.data.campaignId,
          buyerId: actor.id,
        },
      },
      select: {
        id: true,
        campaignId: true,
        campaign: { select: { status: true, campaignNumber: true } },
      },
    });

    if (!participation) return "not-found" as const;
    if (participation.campaign.status !== "ACTIVE") {
      return "not-active" as const;
    }

    await tx.groupBuyParticipation.delete({
      where: { id: participation.id },
    });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "GROUP_BUY_LEFT",
      targetType: "GroupBuyCampaign",
      targetId: participation.campaignId,
      metadata: { campaignNumber: participation.campaign.campaignNumber },
    });

    await appendOutboxEvent(tx, {
      eventType: "group_buy.participation.left",
      aggregateType: "GroupBuyParticipation",
      aggregateId: participation.campaignId,
      payload: { campaignId: participation.campaignId, buyerId: actor.id },
    });

    return "ok" as const;
  });

  revalidatePath("/group-buy");
  revalidatePath(`/group-buy/${parsed.data.campaignId}`);
  revalidatePath("/account");

  if (result === "not-found") return fail("You are not part of this campaign.");
  if (result === "not-active") return fail("You can only leave an active campaign.");
  return ok("You left the campaign.");
}
