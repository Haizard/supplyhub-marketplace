"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { AuditAction, ServiceBookingStatus } from "@/generated/prisma/enums";
import { centsToDecimalString } from "@/features/catalog/money";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/lib/logging/logger";

import { canTransitionBooking } from "./status";
import { bookingSchema, bookingStatusSchema, serviceListingSchema } from "./validation";

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

const BOOKING_AUDIT_ACTIONS: Record<Exclude<ServiceBookingStatus, "REQUESTED">, AuditAction> = {
  CONFIRMED: "SERVICE_BOOKING_CONFIRMED",
  IN_PROGRESS: "SERVICE_BOOKING_IN_PROGRESS",
  COMPLETED: "SERVICE_BOOKING_COMPLETED",
  CANCELLED: "SERVICE_BOOKING_CANCELLED",
  NO_SHOW: "SERVICE_BOOKING_NO_SHOW",
};

/** Vendor create/edit. Listings publish immediately, like catalog products. */
export async function saveServiceListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.servicesMarketplace"))) {
    return fail("Services marketplace is not available yet.");
  }

  const access = await requireStudioAccess("services.manage", "/vendor/services");

  const parsed = serviceListingSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    vendorId: formValue(formData, "vendorId"),
    categoryId: formValue(formData, "categoryId"),
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    currency: formValue(formData, "currency"),
    unitPrice: formValue(formData, "unitPrice"),
    durationMinutes: formValue(formData, "durationMinutes"),
    location: formValue(formData, "location"),
    coverImageUrl: formValue(formData, "coverImageUrl"),
  });
  if (!parsed.success) return failFields(parsed.error);

  // The studio is resolved from the session; a forged vendorId is rejected.
  if (parsed.data.vendorId !== access.vendorId) {
    return fail("You can only manage your own services.");
  }

  const data = parsed.data;
  const isEdit = Boolean(data.listingId);
  const database = getDatabase();

  if (isEdit) {
    const existing = await database.serviceListing.findFirst({
      where: { id: data.listingId!, vendorId: access.vendorId },
      select: { id: true },
    });
    if (!existing) return fail("That service could not be found.");
  }

  let listingId = data.listingId ?? "";
  let listingNumber = "";

  try {
    await database.$transaction(async (tx) => {
      if (isEdit) {
        await tx.serviceListing.update({
          where: { id: listingId },
          data: {
            categoryId: data.categoryId ?? null,
            title: data.title,
            description: data.description ?? "",
            currency: data.currency,
            unitPrice: decimal(data.unitPrice),
            durationMinutes: data.durationMinutes,
            location: data.location ?? "",
            coverImageUrl: data.coverImageUrl ?? null,
          },
        });
      } else {
        listingNumber = makeDocumentNumber("SL");
        const created = await tx.serviceListing.create({
          data: {
            listingNumber,
            vendorId: access.vendorId,
            businessId: access.businessId,
            categoryId: data.categoryId ?? null,
            title: data.title,
            description: data.description ?? "",
            currency: data.currency,
            unitPrice: decimal(data.unitPrice),
            durationMinutes: data.durationMinutes,
            location: data.location ?? "",
            coverImageUrl: data.coverImageUrl ?? null,
            status: "ACTIVE",
            publishedAt: new Date(),
          },
          select: { id: true },
        });
        listingId = created.id;
      }

      await recordAuditEvent(tx, {
        actorId: access.actor.id,
        action: isEdit ? "SERVICE_LISTING_UPDATED" : "SERVICE_LISTING_CREATED",
        targetType: "ServiceListing",
        targetId: listingId,
        metadata: { listingNumber: listingNumber || undefined, title: data.title },
      });

      await appendOutboxEvent(tx, {
        eventType: isEdit ? "service_listing.updated" : "service_listing.created",
        aggregateType: "ServiceListing",
        aggregateId: listingId,
        payload: { listingNumber: listingNumber || undefined, vendorId: access.vendorId },
      });
    });
  } catch (error) {
    logger.error("services.listing_save_failed", { actorId: access.actor.id, error });
    return fail("The service could not be saved.");
  }

  revalidatePath("/vendor/services");
  revalidatePath("/services");
  return ok(isEdit ? "Service updated." : "Service published.");
}

/** Vendor archive — a terminal, ownership-checked action. */
export async function archiveServiceListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.servicesMarketplace"))) {
    return fail("Services marketplace is not available yet.");
  }

  const access = await requireStudioAccess("services.manage", "/vendor/services");
  const parsed = z.uuid().safeParse(formValue(formData, "listingId"));
  if (!parsed.success) return fail("Invalid service.");

  const result = await getDatabase().$transaction(async (tx) => {
    const listing = await tx.serviceListing.findFirst({
      where: { id: parsed.data, vendorId: access.vendorId },
      select: { id: true, listingNumber: true, status: true },
    });
    if (!listing) return "not-found" as const;
    if (listing.status === "ARCHIVED") return "already-archived" as const;

    await tx.serviceListing.update({
      where: { id: listing.id },
      data: { status: "ARCHIVED" },
    });

    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: "SERVICE_LISTING_ARCHIVED",
      targetType: "ServiceListing",
      targetId: listing.id,
      metadata: { listingNumber: listing.listingNumber },
    });

    await appendOutboxEvent(tx, {
      eventType: "service_listing.updated",
      aggregateType: "ServiceListing",
      aggregateId: listing.id,
      payload: { listingNumber: listing.listingNumber, status: "ARCHIVED" },
    });

    return "ok" as const;
  });

  revalidatePath("/vendor/services");
  revalidatePath("/services");
  if (result === "not-found") return fail("That service could not be found.");
  if (result === "already-archived") return fail("That service is already archived.");
  return ok("Service archived.");
}

/** Buyer booking. Price and currency are snapshotted from the stored listing. */
export async function requestServiceBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.servicesMarketplace"))) {
    return fail("Services marketplace is not available yet.");
  }

  const actor = await requireActor("/services");
  const parsed = bookingSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    scheduledAt: formValue(formData, "scheduledAt"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  if (parsed.data.scheduledAt.getTime() <= Date.now()) {
    return fail("Choose a time in the future.");
  }

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const listing = await tx.serviceListing.findFirst({
      where: { id: parsed.data.listingId, status: "ACTIVE" },
      select: {
        id: true,
        listingNumber: true,
        vendorId: true,
        currency: true,
        unitPrice: true,
      },
    });
    if (!listing) return "not-found" as const;

    const created = await tx.serviceBooking.create({
      data: {
        bookingNumber: makeDocumentNumber("SB"),
        serviceId: listing.id,
        buyerId: actor.id,
        vendorId: listing.vendorId,
        currency: listing.currency,
        unitPrice: listing.unitPrice,
        scheduledAt: parsed.data.scheduledAt,
        status: "REQUESTED",
        note: parsed.data.note ?? null,
      },
      select: { id: true, bookingNumber: true },
    });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "SERVICE_BOOKING_REQUESTED",
      targetType: "ServiceBooking",
      targetId: created.id,
      metadata: {
        bookingNumber: created.bookingNumber,
        listingNumber: listing.listingNumber,
        scheduledAt: parsed.data.scheduledAt.toISOString(),
      },
    });

    await appendOutboxEvent(tx, {
      eventType: "service_booking.requested",
      aggregateType: "ServiceBooking",
      aggregateId: created.id,
      payload: {
        bookingNumber: created.bookingNumber,
        serviceId: listing.id,
        vendorId: listing.vendorId,
      },
    });

    return "ok" as const;
  });

  revalidatePath(`/services/${parsed.data.listingId}`);
  revalidatePath("/vendor/services/bookings");
  if (result === "not-found") return fail("That service is no longer available.");
  return ok("Booking requested.");
}

/** Vendor status transition with a forward-only state machine. */
export async function updateServiceBookingStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isFeatureEnabled("phase7.servicesMarketplace"))) {
    return fail("Services marketplace is not available yet.");
  }

  const access = await requireStudioAccess("services.manage", "/vendor/services/bookings");
  const parsed = bookingStatusSchema.safeParse({
    bookingId: formValue(formData, "bookingId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const { bookingId, toStatus } = parsed.data;
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const booking = await tx.serviceBooking.findFirst({
      where: { id: bookingId, vendorId: access.vendorId },
      select: { id: true, bookingNumber: true, status: true },
    });
    if (!booking) return "not-found" as const;
    if (!canTransitionBooking(booking.status, toStatus)) return "invalid-transition" as const;

    await tx.serviceBooking.update({
      where: { id: booking.id },
      data: {
        status: toStatus,
        confirmedAt: toStatus === "CONFIRMED" ? new Date() : undefined,
        completedAt: toStatus === "COMPLETED" || toStatus === "NO_SHOW" ? new Date() : undefined,
        cancelledAt: toStatus === "CANCELLED" ? new Date() : undefined,
      },
    });

    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: BOOKING_AUDIT_ACTIONS[toStatus],
      targetType: "ServiceBooking",
      targetId: booking.id,
      metadata: { bookingNumber: booking.bookingNumber, status: toStatus },
    });

    await appendOutboxEvent(tx, {
      eventType:
        toStatus === "NO_SHOW"
          ? "service_booking.no_show"
          : `service_booking.${toStatus.toLowerCase()}`,
      aggregateType: "ServiceBooking",
      aggregateId: booking.id,
      payload: { bookingNumber: booking.bookingNumber, status: toStatus },
    });

    return "ok" as const;
  });

  revalidatePath("/vendor/services/bookings");
  revalidatePath("/services");
  if (result === "not-found") return fail("That booking could not be found.");
  if (result === "invalid-transition") return fail("That status change is not allowed.");
  return ok("Booking updated.");
}
