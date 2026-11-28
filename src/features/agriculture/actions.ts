"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { logger } from "@/lib/logging/logger";
import { startPayment } from "@/features/payments/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor, requireAdmin } from "@/server/auth/guards";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getPaymentGateway } from "@/server/payments/gateway";

import { ensureAgricultureEnabled, requireFarmerProfile, requireVerifiedFarmer } from "./access";
import { contractTotalMinor, requestIsOpen, validateOffer } from "./rules";
import {
  buyerRequestSchema,
  decideOfferSchema,
  farmSchema,
  farmerProfileSchema,
  listingSchema,
  offerSchema,
  plotSchema,
  verifyFarmerSchema,
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

async function enabled(): Promise<FormState | null> {
  try {
    await ensureAgricultureEnabled();
    return null;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Agriculture network unavailable.");
  }
}

export async function createFarmerProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = farmerProfileSchema.safeParse({
    phone: formValue(formData, "phone"),
    region: formValue(formData, "region"),
    district: formValue(formData, "district"),
    ward: formValue(formData, "ward"),
    village: formValue(formData, "village"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const actor = await requireActor("/agriculture/farmer");

  await getDatabase().agricultureFarmer.upsert({
    where: { userId: actor.id },
    create: { userId: actor.id, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/agriculture/farmer");
  return ok("Farmer profile saved. Verification is required before trading.");
}

export async function saveFarmAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = farmSchema.safeParse({
    name: formValue(formData, "name"),
    sizeValue: formValue(formData, "sizeValue"),
    sizeUnit: formValue(formData, "sizeUnit"),
    ownership: formValue(formData, "ownership"),
    region: formValue(formData, "region"),
    district: formValue(formData, "district"),
    ward: formValue(formData, "ward"),
    village: formValue(formData, "village"),
    waterSource: formValue(formData, "waterSource"),
    soilInfo: formValue(formData, "soilInfo"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  await getDatabase().farm.create({
    data: {
      farmerId: farmer.id,
      ...parsed.data,
      sizeValue: decimal(parsed.data.sizeValue),
    },
  });
  revalidatePath("/agriculture/farmer");
  return ok("Farm registered.");
}

export async function savePlotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = plotSchema.safeParse({
    farmId: formValue(formData, "farmId"),
    name: formValue(formData, "name"),
    sizeValue: formValue(formData, "sizeValue"),
    sizeUnit: formValue(formData, "sizeUnit"),
    boundaryNotes: formValue(formData, "boundaryNotes"),
    latitude: formValue(formData, "latitude"),
    longitude: formValue(formData, "longitude"),
    cropVarieties: formValue(formData, "cropVarieties"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const farmer = await requireFarmerProfile();
  const farm = await getDatabase().farm.findFirst({
    where: { id: parsed.data.farmId, farmerId: farmer.id },
    select: { id: true },
  });
  if (!farm) return fail("Farm not found.");
  try {
    await getDatabase().farmPlot.create({
      data: {
        farmId: farm.id,
        name: parsed.data.name,
        sizeValue: decimal(parsed.data.sizeValue),
        sizeUnit: parsed.data.sizeUnit,
        boundaryNotes: parsed.data.boundaryNotes ?? null,
        latitude: parsed.data.latitude === undefined ? null : decimal(parsed.data.latitude),
        longitude: parsed.data.longitude === undefined ? null : decimal(parsed.data.longitude),
        cropVarieties: parsed.data.cropVarieties ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("A plot with that name already exists on this farm.");
    }
    throw error;
  }
  revalidatePath("/agriculture/farmer");
  return ok("Plot registered.");
}

export async function saveListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = listingSchema.safeParse({
    farmId: formValue(formData, "farmId"),
    plotId: formValue(formData, "plotId"),
    buyerUserId: formValue(formData, "buyerUserId"),
    cropName: formValue(formData, "cropName"),
    variety: formValue(formData, "variety"),
    quantity: formValue(formData, "quantity"),
    unit: formValue(formData, "unit"),
    pricePerUnit: formValue(formData, "pricePerUnit"),
    currency: formValue(formData, "currency"),
    minimumOrder: formValue(formData, "minimumOrder"),
    grade: formValue(formData, "grade"),
    harvestDate: formValue(formData, "harvestDate"),
    collectionLocation: formValue(formData, "collectionLocation"),
    deliveryAvailable: formValue(formData, "deliveryAvailable"),
    organicClaim: formValue(formData, "organicClaim"),
    certifiedClaim: formValue(formData, "certifiedClaim"),
    coverImageUrl: formValue(formData, "coverImageUrl"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let farmer;
  try {
    farmer = await requireVerifiedFarmer();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Verification required.");
  }

  const database = getDatabase();
  if (parsed.data.farmId) {
    const farm = await database.farm.findFirst({
      where: { id: parsed.data.farmId, farmerId: farmer.id },
      select: { id: true },
    });
    if (!farm) return fail("Farm not found.");
  }
  if (parsed.data.plotId) {
    const plot = await database.farmPlot.findFirst({
      where: { id: parsed.data.plotId, farm: { farmerId: farmer.id } },
      select: { id: true },
    });
    if (!plot) return fail("Plot not found.");
  }

  await database.$transaction(async (tx) => {
    const listing = await tx.agriculturalListing.create({
      data: {
        farmerId: farmer.id,
        farmId: parsed.data.farmId ?? null,
        plotId: parsed.data.plotId ?? null,
        buyerUserId: parsed.data.buyerUserId ?? null,
        cropName: parsed.data.cropName,
        variety: parsed.data.variety ?? null,
        quantity: decimal(parsed.data.quantity),
        unit: parsed.data.unit,
        pricePerUnit: decimal(parsed.data.pricePerUnit),
        currency: parsed.data.currency,
        minimumOrder: decimal(parsed.data.minimumOrder),
        grade: parsed.data.grade ?? null,
        harvestDate: parsed.data.harvestDate ?? null,
        collectionLocation: parsed.data.collectionLocation,
        deliveryAvailable: parsed.data.deliveryAvailable,
        organicClaim: parsed.data.organicClaim,
        certifiedClaim: parsed.data.certifiedClaim,
        coverImageUrl: parsed.data.coverImageUrl ?? null,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: (await getSessionActor())?.id ?? null,
      action: "AGRICULTURE_LISTING_PUBLISHED",
      targetType: "AgriculturalListing",
      targetId: listing.id,
      metadata: { cropName: parsed.data.cropName, quantity: parsed.data.quantity },
    });
  });
  revalidatePath("/agriculture/farmer");
  revalidatePath("/agriculture/marketplace");
  return ok("Produce listing published.");
}

export async function createBuyerRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = buyerRequestSchema.safeParse({
    productName: formValue(formData, "productName"),
    quantity: formValue(formData, "quantity"),
    unit: formValue(formData, "unit"),
    qualitySpec: formValue(formData, "qualitySpec"),
    deliveryLocation: formValue(formData, "deliveryLocation"),
    deliveryDeadline: formValue(formData, "deliveryDeadline"),
    offerDeadline: formValue(formData, "offerDeadline"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if (parsed.data.offerDeadline >= parsed.data.deliveryDeadline) {
    return fail("Offer deadline must be before the delivery deadline.");
  }
  const actor = await requireActor("/agriculture/buyers");
  await getDatabase().agriculturalBuyerRequest.create({
    data: {
      buyerUserId: actor.id,
      productName: parsed.data.productName,
      quantity: decimal(parsed.data.quantity),
      unit: parsed.data.unit,
      qualitySpec: parsed.data.qualitySpec ?? null,
      deliveryLocation: parsed.data.deliveryLocation,
      deliveryDeadline: parsed.data.deliveryDeadline,
      offerDeadline: parsed.data.offerDeadline,
    },
  });
  revalidatePath("/agriculture/buyers");
  return ok("Bulk buyer request published.");
}

export async function submitOfferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = offerSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    requestId: formValue(formData, "requestId"),
    quantity: formValue(formData, "quantity"),
    unit: formValue(formData, "unit"),
    pricePerUnit: formValue(formData, "pricePerUnit"),
    currency: formValue(formData, "currency"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let farmer;
  try {
    farmer = await requireVerifiedFarmer();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Verification required.");
  }

  const database = getDatabase();
  const [listing, request] = await Promise.all([
    database.agriculturalListing.findUnique({
      where: { id: parsed.data.listingId },
      select: {
        quantity: true,
        unit: true,
        minimumOrder: true,
        status: true,
        currency: true,
        buyerUserId: true,
      },
    }),
    parsed.data.requestId
      ? database.agriculturalBuyerRequest.findUnique({
          where: { id: parsed.data.requestId },
          select: {
            quantity: true,
            unit: true,
            offerDeadline: true,
            status: true,
            buyerUserId: true,
          },
        })
      : Promise.resolve(null),
  ]);
  if (!listing) return fail("Listing not found.");
  const listingForCheck = {
    quantity: Number(listing.quantity.toString()),
    unit: listing.unit,
    minimumOrder: Number(listing.minimumOrder.toString()),
    status: listing.status,
    currency: listing.currency,
  };
  const requestForCheck = request
    ? {
        quantity: Number(request.quantity.toString()),
        unit: request.unit,
        offerDeadline: request.offerDeadline,
        status: request.status,
      }
    : null;
  const check = validateOffer(listingForCheck, requestForCheck, parsed.data);
  if (!check.ok) return fail(check.reason);

  const buyerUserId = request?.buyerUserId ?? listing.buyerUserId;
  if (!buyerUserId) return fail("This listing has no buyer; respond to a buyer request instead.");
  if (request && !requestIsOpen(request)) return fail("That buyer request is closed.");

  await database.$transaction(async (tx) => {
    const offer = await tx.agriculturalOffer.create({
      data: {
        requestId: parsed.data.requestId ?? null,
        listingId: parsed.data.listingId,
        farmerId: farmer.id,
        buyerUserId,
        quantity: decimal(parsed.data.quantity),
        unit: parsed.data.unit,
        pricePerUnit: decimal(parsed.data.pricePerUnit),
        currency: parsed.data.currency,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: (await getSessionActor())?.id ?? null,
      action: "AGRICULTURE_OFFER_SUBMITTED",
      targetType: "AgriculturalOffer",
      targetId: offer.id,
      metadata: { listingId: parsed.data.listingId, requestId: parsed.data.requestId ?? null },
    });
  });
  revalidatePath("/agriculture/farmer");
  revalidatePath("/agriculture/buyers");
  return ok("Offer submitted to the buyer.");
}

/** Buyer accepts an offer: creates the shared Order and starts verified payment. */
export async function decideOfferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = decideOfferSchema.safeParse({
    offerId: formValue(formData, "offerId"),
    decision: formValue(formData, "decision"),
    phone: formValue(formData, "phone"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const actor = await requireActor("/agriculture/buyers");
  const database = getDatabase();
  const offer = await database.agriculturalOffer.findFirst({
    where: { id: parsed.data.offerId, buyerUserId: actor.id, status: "PENDING" },
    select: {
      id: true,
      farmerId: true,
      listingId: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      currency: true,
      listing: { select: { cropName: true, collectionLocation: true, variety: true } },
    },
  });
  if (!offer) return fail("Offer not found or already decided.");

  if (parsed.data.decision === "REJECT") {
    await database.$transaction(async (tx) => {
      await tx.agriculturalOffer.update({
        where: { id: offer.id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      await recordAuditEvent(tx, {
        actorId: actor.id,
        action: "AGRICULTURE_OFFER_DECIDED",
        targetType: "AgriculturalOffer",
        targetId: offer.id,
        metadata: { decision: "REJECTED" },
      });
    });
    revalidatePath("/agriculture/buyers");
    return ok("Offer rejected.");
  }

  const totalCents = contractTotalMinor(
    Number(offer.quantity.toString()),
    Number(offer.pricePerUnit.toString()),
  );
  const total = new Prisma.Decimal(totalCents).div(100);
  const contractId = await database.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: makeDocumentNumber("AG"),
        customerId: actor.id,
        status: "AWAITING_PAYMENT",
        currency: offer.currency,
        subtotal: total,
        total,
        recipientName: actor.name ?? actor.email,
        contactEmail: actor.email,
        addressLine1: offer.listing.collectionLocation,
        city: "-",
        region: "-",
        postalCode: "-",
        countryCode: "TZ",
        deliveryMethod: "PICKUP",
      },
      select: { id: true, orderNumber: true },
    });
    const contract = await tx.agriculturalContract.create({
      data: {
        contractNumber: makeDocumentNumber("AC"),
        offerId: offer.id,
        farmerId: offer.farmerId,
        buyerUserId: actor.id,
        quantity: offer.quantity,
        unit: offer.unit,
        pricePerUnit: offer.pricePerUnit,
        total,
        currency: offer.currency,
        status: "PENDING_PAYMENT",
        orderId: order.id,
        termsSnapshot: {
          cropName: offer.listing.cropName,
          variety: offer.listing.variety,
          quantity: offer.quantity.toString(),
          unit: offer.unit,
          pricePerUnit: offer.pricePerUnit.toString(),
          total: total.toString(),
          currency: offer.currency,
          collectionLocation: offer.listing.collectionLocation,
        } satisfies Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await tx.agriculturalOffer.update({
      where: { id: offer.id },
      data: { status: "ACCEPTED", decidedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "AGRICULTURE_CONTRACT_CREATED",
      targetType: "AgriculturalContract",
      targetId: contract.id,
      metadata: { orderNumber: order.orderNumber, total: total.toString() },
    });
    return { contractId: contract.id, orderNumber: order.orderNumber };
  });

  if (!parsed.data.phone) {
    return ok(`Contract created (${contractId.orderNumber}). Add a phone number to start payment.`);
  }

  try {
    const payment = await startPayment(database, getPaymentGateway(), {
      orderNumber: contractId.orderNumber,
      customerId: actor.id,
      method: "mpesa",
      phone: parsed.data.phone,
    });
    revalidatePath("/agriculture/buyers");
    return ok(
      `Order ${contractId.orderNumber} created. Payment ${payment.status}; complete it with the provider.`,
    );
  } catch (error) {
    logger.warn("agriculture.payment_start_failed", {
      orderNumber: contractId.orderNumber,
      message: error instanceof Error ? error.message : "unknown error",
    });
    revalidatePath("/agriculture/buyers");
    return fail("Order created, but payment could not be started. No money was moved.");
  }
}

export async function verifyFarmerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = verifyFarmerSchema.safeParse({
    farmerId: formValue(formData, "farmerId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const admin = await requireActor("/admin/agriculture");
  await requireAdmin();

  const result = await getDatabase().$transaction(async (tx) => {
    const farmer = await tx.agricultureFarmer.findUnique({
      where: { id: parsed.data.farmerId },
      select: { id: true, verificationStatus: true },
    });
    if (!farmer) return null;
    await tx.agricultureFarmer.update({
      where: { id: farmer.id },
      data: {
        verificationStatus: parsed.data.decision === "VERIFY" ? "VERIFIED" : "REJECTED",
        verifiedById: admin.id,
        verifiedAt: new Date(),
        note: parsed.data.note ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "AGRICULTURE_FARMER_VERIFIED",
      targetType: "AgricultureFarmer",
      targetId: farmer.id,
      metadata: { decision: parsed.data.decision },
    });
    return farmer.id;
  });
  if (!result) return fail("Farmer not found.");
  revalidatePath("/admin/agriculture");
  revalidatePath("/agriculture/farmer");
  return ok(parsed.data.decision === "VERIFY" ? "Farmer verified." : "Farmer rejected.");
}
