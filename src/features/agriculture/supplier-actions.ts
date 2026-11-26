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

import { ensureAgricultureEnabled, requireVerifiedFarmer } from "./access";
import { requireSupplierProfile, requireVerifiedSupplier } from "./supplier-access";
import {
  bookingsOverlap,
  canPublishInput,
  canPublishService,
  canTransitionBooking,
  inputOrderTotalMinor,
  type PublishResult,
} from "./supplier-rules";
import {
  bookingDecisionSchema,
  bookingQuoteSchema,
  bookingRequestSchema,
  inputOrderSchema,
  inputSchema,
  serviceSchema,
  supplierProfileSchema,
  verifySupplierSchema,
} from "./supplier-validation";

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
const DAY_MS = 24 * 60 * 60 * 1000;

async function enabled(): Promise<FormState | null> {
  try {
    await ensureAgricultureEnabled();
    return null;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Agriculture network unavailable.");
  }
}

function publishFail(result: PublishResult): string | null {
  return result.ok ? null : result.reason;
}

export async function registerSupplierAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = supplierProfileSchema.safeParse({
    type: formValue(formData, "type"),
    businessName: formValue(formData, "businessName"),
    registrationNumber: formValue(formData, "registrationNumber"),
    licenseReference: formValue(formData, "licenseReference"),
    insuranceReference: formValue(formData, "insuranceReference"),
    phone: formValue(formData, "phone"),
    region: formValue(formData, "region"),
    district: formValue(formData, "district"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const actor = await requireActor("/agriculture/suppliers");
  await getDatabase().agriculturalSupplier.upsert({
    where: { userId: actor.id },
    create: { userId: actor.id, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/agriculture/suppliers");
  return ok("Supplier profile saved. Verification is required before publishing.");
}

export async function saveInputAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = inputSchema.safeParse({
    name: formValue(formData, "name"),
    category: formValue(formData, "category"),
    description: formValue(formData, "description"),
    quantity: formValue(formData, "quantity"),
    unit: formValue(formData, "unit"),
    pricePerUnit: formValue(formData, "pricePerUnit"),
    currency: formValue(formData, "currency"),
    minimumOrder: formValue(formData, "minimumOrder"),
    treatmentStatus: formValue(formData, "treatmentStatus"),
    registrationRef: formValue(formData, "registrationRef"),
    safetyNotes: formValue(formData, "safetyNotes"),
    organicClaim: formValue(formData, "organicClaim"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let supplier;
  try {
    supplier = await requireVerifiedSupplier();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Verification required.");
  }
  const check = publishFail(
    canPublishInput({
      verificationStatus: supplier.verificationStatus,
      supplierType: supplier.type,
      category: parsed.data.category,
      registrationRef: parsed.data.registrationRef,
    }),
  );
  if (check) return fail(check);

  const input = await getDatabase().agriculturalInput.create({
    data: {
      supplierId: supplier.id,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      quantity: decimal(parsed.data.quantity),
      unit: parsed.data.unit,
      pricePerUnit: decimal(parsed.data.pricePerUnit),
      currency: parsed.data.currency,
      minimumOrder: decimal(parsed.data.minimumOrder),
      treatmentStatus: parsed.data.treatmentStatus ?? null,
      registrationRef: parsed.data.registrationRef ?? null,
      safetyNotes: parsed.data.safetyNotes ?? null,
      organicClaim: parsed.data.organicClaim,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  await recordAuditEvent(getDatabase(), {
    actorId: (await getSessionActor())?.id ?? null,
    action: "AGRICULTURE_INPUT_PUBLISHED",
    targetType: "AgriculturalInput",
    targetId: input.id,
    metadata: { category: parsed.data.category, name: parsed.data.name },
  });
  revalidatePath("/agriculture/suppliers");
  revalidatePath("/agriculture/inputs");
  return ok("Input published.");
}

export async function saveServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = serviceSchema.safeParse({
    serviceType: formValue(formData, "serviceType"),
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    rateAmount: formValue(formData, "rateAmount"),
    rateUnit: formValue(formData, "rateUnit"),
    currency: formValue(formData, "currency"),
    serviceArea: formValue(formData, "serviceArea"),
    qualificationRef: formValue(formData, "qualificationRef"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let supplier;
  try {
    supplier = await requireVerifiedSupplier();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Verification required.");
  }
  const check = publishFail(
    canPublishService({
      verificationStatus: supplier.verificationStatus,
      supplierType: supplier.type,
      serviceType: parsed.data.serviceType,
      qualificationRef: parsed.data.qualificationRef,
    }),
  );
  if (check) return fail(check);

  const service = await getDatabase().agriculturalService.create({
    data: {
      supplierId: supplier.id,
      serviceType: parsed.data.serviceType,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      rateAmount: decimal(parsed.data.rateAmount),
      rateUnit: parsed.data.rateUnit,
      currency: parsed.data.currency,
      serviceArea: parsed.data.serviceArea ?? null,
      qualificationRef: parsed.data.qualificationRef ?? null,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  await recordAuditEvent(getDatabase(), {
    actorId: (await getSessionActor())?.id ?? null,
    action: "AGRICULTURE_SERVICE_PUBLISHED",
    targetType: "AgriculturalService",
    targetId: service.id,
    metadata: { serviceType: parsed.data.serviceType },
  });
  revalidatePath("/agriculture/suppliers");
  revalidatePath("/agriculture/services");
  return ok("Service published.");
}

export async function verifySupplierAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = verifySupplierSchema.safeParse({
    supplierId: formValue(formData, "supplierId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  await requireAdmin();
  const actor = await requireActor("/admin/agriculture");

  const result = await getDatabase().$transaction(async (tx) => {
    const supplier = await tx.agriculturalSupplier.findUnique({
      where: { id: parsed.data.supplierId },
      select: { id: true },
    });
    if (!supplier) return null;
    await tx.agriculturalSupplier.update({
      where: { id: supplier.id },
      data: {
        verificationStatus: parsed.data.decision === "VERIFY" ? "VERIFIED" : "REJECTED",
        verifiedById: actor.id,
        verifiedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "AGRICULTURE_SUPPLIER_VERIFIED",
      targetType: "AgriculturalSupplier",
      targetId: supplier.id,
      metadata: { decision: parsed.data.decision },
    });
    return supplier.id;
  });
  if (!result) return fail("Supplier not found.");
  revalidatePath("/admin/agriculture");
  revalidatePath("/agriculture/suppliers");
  return ok(parsed.data.decision === "VERIFY" ? "Supplier verified." : "Supplier rejected.");
}

export async function requestBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = bookingRequestSchema.safeParse({
    serviceId: formValue(formData, "serviceId"),
    requestedFor: formValue(formData, "requestedFor"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let farmer;
  try {
    farmer = await requireVerifiedFarmer();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Verification required.");
  }
  const service = await getDatabase().agriculturalService.findFirst({
    where: { id: parsed.data.serviceId, status: "PUBLISHED" },
    select: { id: true, supplierId: true, currency: true },
  });
  if (!service) return fail("Service not available.");
  if (parsed.data.requestedFor.getTime() <= Date.now()) return fail("Choose a future date.");

  await getDatabase().agriculturalServiceBooking.create({
    data: {
      bookingNumber: makeDocumentNumber("AB"),
      serviceId: service.id,
      supplierId: service.supplierId,
      farmerId: farmer.id,
      requestedFor: parsed.data.requestedFor,
      currency: service.currency,
      quoteNote: parsed.data.note ?? null,
    },
  });
  revalidatePath("/agriculture/farmer");
  revalidatePath("/agriculture/suppliers");
  return ok("Booking requested. The provider will send a quotation.");
}

export async function quoteBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = bookingQuoteSchema.safeParse({
    bookingId: formValue(formData, "bookingId"),
    quoteAmount: formValue(formData, "quoteAmount"),
    scheduledAt: formValue(formData, "scheduledAt"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let supplier;
  try {
    supplier = await requireSupplierProfile();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Supplier profile required.");
  }
  const database = getDatabase();
  const booking = await database.agriculturalServiceBooking.findFirst({
    where: { id: parsed.data.bookingId, supplierId: supplier.id },
    select: { id: true, status: true, currency: true },
  });
  if (!booking || !canTransitionBooking(booking.status, "QUOTED")) {
    return fail("That booking cannot be quoted.");
  }
  const start = parsed.data.scheduledAt;
  const end = new Date(start.getTime() + DAY_MS);
  const clash = await database.agriculturalServiceBooking.findFirst({
    where: {
      supplierId: supplier.id,
      id: { not: booking.id },
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      scheduledAt: { not: null },
    },
    select: { scheduledAt: true },
  });
  if (
    clash?.scheduledAt &&
    bookingsOverlap(
      { start, end },
      { start: clash.scheduledAt, end: new Date(clash.scheduledAt.getTime() + DAY_MS) },
    )
  ) {
    return fail("The provider already has a job on that day.");
  }
  await database.$transaction(async (tx) => {
    await tx.agriculturalServiceBooking.update({
      where: { id: booking.id },
      data: {
        status: "QUOTED",
        quoteAmount: decimal(parsed.data.quoteAmount),
        scheduledAt: start,
        quoteNote: parsed.data.note ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: (await getSessionActor())?.id ?? null,
      action: "AGRICULTURE_BOOKING_CHANGED",
      targetType: "AgriculturalServiceBooking",
      targetId: booking.id,
      metadata: { status: "QUOTED" },
    });
  });
  revalidatePath("/agriculture/farmer");
  revalidatePath("/agriculture/suppliers");
  return ok("Quotation sent with a proposed scheduled date.");
}

export async function decideBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = bookingDecisionSchema.safeParse({
    bookingId: formValue(formData, "bookingId"),
    decision: formValue(formData, "decision"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let supplier;
  try {
    supplier = await requireSupplierProfile();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Supplier profile required.");
  }
  const targetStatus =
    parsed.data.decision === "CONFIRM"
      ? "CONFIRMED"
      : parsed.data.decision === "START"
        ? "IN_PROGRESS"
        : parsed.data.decision === "COMPLETE"
          ? "COMPLETED"
          : "CANCELLED";
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const booking = await tx.agriculturalServiceBooking.findFirst({
      where: { id: parsed.data.bookingId, supplierId: supplier.id },
      select: { id: true, status: true },
    });
    if (!booking || !canTransitionBooking(booking.status, targetStatus)) return null;
    await tx.agriculturalServiceBooking.update({
      where: { id: booking.id },
      data: {
        status: targetStatus,
        completedAt: targetStatus === "COMPLETED" ? new Date() : null,
        cancelledAt: targetStatus === "CANCELLED" ? new Date() : null,
        cancellationReason: targetStatus === "CANCELLED" ? (parsed.data.reason ?? null) : null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: (await getSessionActor())?.id ?? null,
      action: "AGRICULTURE_BOOKING_CHANGED",
      targetType: "AgriculturalServiceBooking",
      targetId: booking.id,
      metadata: { status: targetStatus },
    });
    return booking.id;
  });
  if (!result) return fail("That status change is not allowed.");
  revalidatePath("/agriculture/farmer");
  revalidatePath("/agriculture/suppliers");
  return ok(`Booking ${targetStatus.toLowerCase()}.`);
}

/** Farmer buys an input through the shared Order/Payment flow. */
export async function purchaseInputAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;
  const parsed = inputOrderSchema.safeParse({
    inputId: formValue(formData, "inputId"),
    quantity: formValue(formData, "quantity"),
    phone: formValue(formData, "phone"),
  });
  if (!parsed.success) return failFields(parsed.error);
  let farmer;
  try {
    farmer = await requireVerifiedFarmer();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Verification required.");
  }
  const actor = await requireActor("/agriculture/inputs");
  const database = getDatabase();
  const input = await database.agriculturalInput.findFirst({
    where: { id: parsed.data.inputId, status: "PUBLISHED" },
    select: {
      id: true,
      supplierId: true,
      name: true,
      pricePerUnit: true,
      currency: true,
      minimumOrder: true,
      quantity: true,
      unit: true,
    },
  });
  if (!input) return fail("Input not available.");
  if (parsed.data.quantity < Number(input.minimumOrder.toString())) {
    return fail(`Minimum order is ${input.minimumOrder.toString()}.`);
  }
  if (parsed.data.quantity > Number(input.quantity.toString())) {
    return fail("Requested quantity exceeds available stock.");
  }

  const totalCents = inputOrderTotalMinor(
    parsed.data.quantity,
    Number(input.pricePerUnit.toString()),
  );
  const total = new Prisma.Decimal(totalCents).div(100);
  const result = await database.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: makeDocumentNumber("AI"),
        customerId: actor.id,
        status: "AWAITING_PAYMENT",
        currency: input.currency,
        subtotal: total,
        total,
        recipientName: actor.name,
        contactEmail: actor.email,
        addressLine1: "Agricultural input collection",
        city: "-",
        region: "-",
        postalCode: "-",
        countryCode: "TZ",
        deliveryMethod: "PICKUP",
      },
      select: { id: true, orderNumber: true },
    });
    const inputOrder = await tx.agriculturalInputOrder.create({
      data: {
        supplierId: input.supplierId,
        inputId: input.id,
        farmerId: farmer.id,
        quantity: decimal(parsed.data.quantity),
        unit: input.unit,
        total,
        currency: input.currency,
        orderId: order.id,
        termsSnapshot: {
          name: input.name,
          quantity: parsed.data.quantity,
          pricePerUnit: input.pricePerUnit.toString(),
          total: total.toString(),
          currency: input.currency,
        } satisfies Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "AGRICULTURE_INPUT_ORDER_CREATED",
      targetType: "AgriculturalInputOrder",
      targetId: inputOrder.id,
      metadata: { orderNumber: order.orderNumber, total: total.toString() },
    });
    return order;
  });

  if (!parsed.data.phone)
    return ok(`Order ${result.orderNumber} created. Add a phone to start payment.`);
  try {
    const payment = await startPayment(database, getPaymentGateway(), {
      orderNumber: result.orderNumber,
      customerId: actor.id,
      method: "mpesa",
      phone: parsed.data.phone,
    });
    return ok(`Order ${result.orderNumber} created; payment ${payment.status}.`);
  } catch (error) {
    logger.warn("agriculture.input_payment_failed", {
      orderNumber: result.orderNumber,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return fail("Order created but payment could not be started. No money was moved.");
  }
}
