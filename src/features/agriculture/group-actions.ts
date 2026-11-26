"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { logger } from "@/lib/logging/logger";
import { startPayment } from "@/features/payments/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";
import { getPaymentGateway } from "@/server/payments/gateway";

import { ensureAgricultureEnabled, requireFarmerProfile } from "./access";
import {
  agreementTotalMinor,
  canTransitionAgreement,
  isWithinTolerance,
  varianceKg,
} from "./group-rules";
import {
  acceptAgreementSchema,
  agreementStatusSchema,
  farmerGroupSchema,
  groupMemberSchema,
  harvestAgreementSchema,
  harvestDeliverySchema,
} from "./group-validation";

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
const PATH = "/agriculture/groups";

async function enabled(): Promise<FormState | null> {
  try {
    await ensureAgricultureEnabled();
    return null;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Agriculture network unavailable.");
  }
}

export async function createFarmerGroupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = farmerGroupSchema.safeParse({
    name: formValue(formData, "name"),
    registrationNumber: formValue(formData, "registrationNumber"),
    region: formValue(formData, "region"),
    district: formValue(formData, "district"),
    description: formValue(formData, "description"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();

  await getDatabase().$transaction(async (tx) => {
    const group = await tx.farmerGroup.create({
      data: {
        groupCode: makeDocumentNumber("FG"),
        name: parsed.data.name,
        registrationNumber: parsed.data.registrationNumber ?? null,
        coordinatorId: farmer.id,
        region: parsed.data.region ?? null,
        district: parsed.data.district ?? null,
        description: parsed.data.description ?? null,
      },
      select: { id: true },
    });
    await tx.farmerGroupMember.create({
      data: { groupId: group.id, farmerId: farmer.id, role: "COORDINATOR" },
    });
    await recordAuditEvent(tx, {
      actorId: farmer.userId,
      action: "AGRICULTURE_GROUP_CREATED",
      targetType: "FarmerGroup",
      targetId: group.id,
      metadata: { name: parsed.data.name },
    });
  });
  revalidatePath(PATH);
  return ok("Farmer group created.");
}

export async function changeGroupMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = groupMemberSchema.safeParse({
    groupId: formValue(formData, "groupId"),
    farmerId: formValue(formData, "farmerId"),
    action: formValue(formData, "action"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const database = getDatabase();
  const group = await database.farmerGroup.findFirst({
    where: { id: parsed.data.groupId, coordinatorId: farmer.id, isActive: true },
    select: { id: true },
  });
  if (!group) return fail("Only the group coordinator can manage members.");

  const result = await database.$transaction(async (tx) => {
    if (parsed.data.action === "ADD") {
      const target = await tx.agricultureFarmer.findUnique({
        where: { id: parsed.data.farmerId },
        select: { id: true },
      });
      if (!target) return null;
      await tx.farmerGroupMember.upsert({
        where: {
          groupId_farmerId: { groupId: group.id, farmerId: target.id },
        },
        create: { groupId: group.id, farmerId: target.id, role: "MEMBER" },
        update: { status: "ACTIVE" },
      });
      return target.id;
    }
    const removed = await tx.farmerGroupMember.updateMany({
      where: {
        groupId: group.id,
        farmerId: parsed.data.farmerId,
        role: { not: "COORDINATOR" },
      },
      data: { status: "INACTIVE" },
    });
    return removed.count > 0 ? parsed.data.farmerId : null;
  });
  if (!result) return fail("Farmer not found or membership cannot be changed.");

  await recordAuditEvent(database, {
    actorId: farmer.userId,
    action: "AGRICULTURE_GROUP_MEMBER_CHANGED",
    targetType: "FarmerGroup",
    targetId: group.id,
    metadata: { farmerId: result, action: parsed.data.action },
  });
  revalidatePath(PATH);
  return ok(parsed.data.action === "ADD" ? "Farmer added to group." : "Membership deactivated.");
}

export async function createHarvestAgreementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = harvestAgreementSchema.safeParse({
    farmerId: formValue(formData, "farmerId"),
    groupId: formValue(formData, "groupId"),
    cropName: formValue(formData, "cropName"),
    variety: formValue(formData, "variety"),
    expectedQuantity: formValue(formData, "expectedQuantity"),
    unit: formValue(formData, "unit"),
    qualitySpec: formValue(formData, "qualitySpec"),
    pricePerUnit: formValue(formData, "pricePerUnit"),
    pricingFormula: formValue(formData, "pricingFormula"),
    currency: formValue(formData, "currency"),
    deliveryDate: formValue(formData, "deliveryDate"),
    collectionLocation: formValue(formData, "collectionLocation"),
    paymentTerms: formValue(formData, "paymentTerms"),
    variancePolicy: formValue(formData, "variancePolicy"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if (!parsed.data.farmerId && !parsed.data.groupId) {
    return fail("Choose a farmer or a farmer group.");
  }
  const actor = await requireActor("/agriculture/contracts");
  const database = getDatabase();
  if (parsed.data.groupId) {
    const group = await database.farmerGroup.findFirst({
      where: { id: parsed.data.groupId, isActive: true },
      select: { id: true },
    });
    if (!group) return fail("Farmer group not found.");
  }
  if (parsed.data.farmerId) {
    const farmer = await database.agricultureFarmer.findUnique({
      where: { id: parsed.data.farmerId },
      select: { id: true },
    });
    if (!farmer) return fail("Farmer not found.");
  }

  const price = parsed.data.pricePerUnit ?? 0;
  const estimatedTotal =
    price > 0 ? decimal(agreementTotalMinor(parsed.data.expectedQuantity, price)).div(100) : null;
  const snapshot: Prisma.InputJsonObject = {
    cropName: parsed.data.cropName,
    variety: parsed.data.variety ?? null,
    expectedQuantity: parsed.data.expectedQuantity,
    unit: parsed.data.unit,
    qualitySpec: parsed.data.qualitySpec ?? null,
    pricePerUnit: parsed.data.pricePerUnit ?? null,
    pricingFormula: parsed.data.pricingFormula ?? null,
    currency: parsed.data.currency,
    deliveryDate: parsed.data.deliveryDate.toISOString(),
    collectionLocation: parsed.data.collectionLocation,
    paymentTerms: parsed.data.paymentTerms,
    variancePolicy: parsed.data.variancePolicy ?? null,
  };

  await database.$transaction(async (tx) => {
    const agreement = await tx.harvestPurchaseAgreement.create({
      data: {
        agreementNumber: makeDocumentNumber("HA"),
        buyerUserId: actor.id,
        farmerId: parsed.data.farmerId ?? null,
        groupId: parsed.data.groupId ?? null,
        cropName: parsed.data.cropName,
        variety: parsed.data.variety ?? null,
        expectedQuantity: decimal(parsed.data.expectedQuantity),
        unit: parsed.data.unit,
        qualitySpec: parsed.data.qualitySpec ?? null,
        pricePerUnit:
          parsed.data.pricePerUnit === undefined ? null : decimal(parsed.data.pricePerUnit),
        pricingFormula: parsed.data.pricingFormula ?? null,
        estimatedTotal,
        currency: parsed.data.currency,
        deliveryDate: parsed.data.deliveryDate,
        collectionLocation: parsed.data.collectionLocation,
        paymentTerms: parsed.data.paymentTerms,
        variancePolicy: parsed.data.variancePolicy ?? null,
        status: "PENDING_FARMER",
        termsSnapshot: snapshot,
        buyerAcceptedAt: new Date(),
        createdById: actor.id,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "AGRICULTURE_AGREEMENT_CREATED",
      targetType: "HarvestPurchaseAgreement",
      targetId: agreement.id,
      metadata: { cropName: parsed.data.cropName, groupId: parsed.data.groupId ?? null },
    });
  });
  revalidatePath("/agriculture/contracts");
  return ok("Harvest agreement sent to the farmer/group for acceptance.");
}

export async function acceptHarvestAgreementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = acceptAgreementSchema.safeParse({
    agreementId: formValue(formData, "agreementId"),
    phone: formValue(formData, "phone"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const actor = await requireActor("/agriculture/contracts");
  const database = getDatabase();
  const agreement = await database.harvestPurchaseAgreement.findFirst({
    where: {
      id: parsed.data.agreementId,
      status: "PENDING_FARMER",
      OR: [{ farmerId: farmer.id }, { group: { coordinatorId: farmer.id } }],
    },
    select: {
      id: true,
      currency: true,
      estimatedTotal: true,
      buyerUserId: true,
      cropName: true,
    },
  });
  if (!agreement) return fail("Agreement not found for your farm or group.");

  let orderNumber: string | null = null;
  if (agreement.estimatedTotal && Number(agreement.estimatedTotal.toString()) > 0) {
    await database.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: makeDocumentNumber("AH"),
          customerId: agreement.buyerUserId,
          status: "AWAITING_PAYMENT",
          currency: agreement.currency,
          subtotal: agreement.estimatedTotal!,
          total: agreement.estimatedTotal!,
          recipientName: actor.name,
          contactEmail: actor.email,
          addressLine1: "Harvest agreement collection",
          city: "-",
          region: "-",
          postalCode: "-",
          countryCode: "TZ",
          deliveryMethod: "PICKUP",
        },
        select: { id: true, orderNumber: true },
      });
      await tx.harvestPurchaseAgreement.update({
        where: { id: agreement.id },
        data: { status: "ACCEPTED", farmerAcceptedAt: new Date(), orderId: order.id },
      });
      orderNumber = order.orderNumber;
    });
  } else {
    await database.harvestPurchaseAgreement.update({
      where: { id: agreement.id },
      data: { status: "ACCEPTED", farmerAcceptedAt: new Date() },
    });
  }

  if (orderNumber && parsed.data.phone) {
    try {
      await startPayment(database, getPaymentGateway(), {
        orderNumber,
        customerId: agreement.buyerUserId,
        method: "mpesa",
        phone: parsed.data.phone,
      });
    } catch (error) {
      logger.warn("agriculture.agreement_payment_failed", {
        orderNumber,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  revalidatePath("/agriculture/contracts");
  return ok("Agreement accepted. Payment status follows verified provider callbacks.");
}

export async function recordHarvestDeliveryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = harvestDeliverySchema.safeParse({
    agreementId: formValue(formData, "agreementId"),
    deliveredQuantity: formValue(formData, "deliveredQuantity"),
    grade: formValue(formData, "grade"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const database = getDatabase();
  const agreement = await database.harvestPurchaseAgreement.findFirst({
    where: {
      id: parsed.data.agreementId,
      status: "ACCEPTED",
      OR: [{ farmerId: farmer.id }, { group: { coordinatorId: farmer.id } }],
    },
    select: { id: true, expectedQuantity: true, unit: true, variancePolicy: true },
  });
  if (!agreement) return fail("Accepted agreement not found for your farm or group.");

  const expected = Number(agreement.expectedQuantity.toString());
  const variance = varianceKg(expected, parsed.data.deliveredQuantity);
  await database.$transaction(async (tx) => {
    await tx.harvestDeliveryRecord.create({
      data: {
        agreementId: agreement.id,
        deliveredQuantity: decimal(parsed.data.deliveredQuantity),
        acceptedQuantity: decimal(parsed.data.deliveredQuantity),
        unit: agreement.unit,
        grade: parsed.data.grade ?? null,
        varianceKg: decimal(variance),
        note: parsed.data.note ?? null,
        recordedById: farmer.userId,
      },
    });
    await tx.harvestPurchaseAgreement.update({
      where: { id: agreement.id },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: farmer.userId,
      action: "AGRICULTURE_DELIVERY_RECORDED",
      targetType: "HarvestPurchaseAgreement",
      targetId: agreement.id,
      metadata: {
        varianceKg: variance,
        withinTolerance: isWithinTolerance(expected, parsed.data.deliveredQuantity),
      },
    });
  });
  revalidatePath("/agriculture/contracts");
  return ok(`Delivery recorded. Quantity variance ${variance} kg.`);
}

export async function decideAgreementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = agreementStatusSchema.safeParse({
    agreementId: formValue(formData, "agreementId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const actor = await requireActor("/agriculture/contracts");
  const database = getDatabase();
  const agreement = await database.harvestPurchaseAgreement.findFirst({
    where: { id: parsed.data.agreementId, buyerUserId: actor.id },
    select: {
      id: true,
      status: true,
      order: { select: { payments: { select: { status: true }, take: 1 } } },
    },
  });
  if (!agreement) return fail("Agreement not found.");

  const target =
    parsed.data.decision === "COMPLETE"
      ? "COMPLETED"
      : parsed.data.decision === "DISPUTE"
        ? "DISPUTED"
        : "CANCELLED";
  if (!canTransitionAgreement(agreement.status, target)) {
    return fail("That status change is not allowed.");
  }
  if (target === "COMPLETED" && agreement.order?.payments[0]?.status !== "SUCCEEDED") {
    return fail("A verified payment is required before completion.");
  }

  await database.$transaction(async (tx) => {
    await tx.harvestPurchaseAgreement.update({
      where: { id: agreement.id },
      data: {
        status: target,
        completedAt: target === "COMPLETED" ? new Date() : undefined,
        cancelledAt: target === "CANCELLED" ? new Date() : undefined,
      },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "AGRICULTURE_AGREEMENT_CHANGED",
      targetType: "HarvestPurchaseAgreement",
      targetId: agreement.id,
      metadata: { status: target, note: parsed.data.note ?? null },
    });
  });
  revalidatePath("/agriculture/contracts");
  return ok(`Agreement ${target.toLowerCase()}.`);
}
