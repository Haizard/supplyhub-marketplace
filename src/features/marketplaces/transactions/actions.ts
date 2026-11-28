"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { haversineKm } from "@/features/logistics/dispatch";
import { calculateDeliveryFee, type PricingRule } from "@/features/logistics/pricing";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { canCancelTransaction, canCompleteTransaction } from "./status";
import {
  cancelTransactionSchema,
  completeTransactionSchema,
  createTransactionSchema,
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

const PATH = "/orders";
const decimal = (value: number) => new Prisma.Decimal(value);

async function enabled(): Promise<FormState | null> {
  // A combined transaction always books a delivery, so the logistics network
  // carries the gate. The service leg is optional and gated by its own feature.
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

/** Documented fallback when no pricing rule is configured (see docs/01-product-vision.md). */
function fallbackPricingRule(currency: string): PricingRule {
  return {
    currency,
    baseFee: new Prisma.Decimal("5000"),
    perKmRate: new Prisma.Decimal("2000"),
    minimumFee: new Prisma.Decimal("5000"),
    maximumFee: new Prisma.Decimal("50000"),
  };
}

/**
 * Connects an order to a logistics job and an optional service booking.
 *
 * The order is the join key: retail orders and produce (agriculture) orders are
 * both `Order` rows, so one booking flow serves both marketplaces. Ownership is
 * checked against the session, and the delivery company, the service listing,
 * the price and the scheduled time are all re-read server-side.
 */
export async function createTransactionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await enabled();
  if (disabled) return disabled;

  const actor = await requireActor(`${PATH}`);
  const parsed = createTransactionSchema.safeParse({
    orderNumber: formValue(formData, "orderNumber"),
    companyId: formValue(formData, "companyId"),
    serviceListingId: formValue(formData, "serviceListingId"),
    scheduledAt: formValue(formData, "scheduledAt"),
    pickupName: formValue(formData, "pickupName"),
    pickupAddress: formValue(formData, "pickupAddress"),
    pickupLatitude: formValue(formData, "pickupLatitude"),
    pickupLongitude: formValue(formData, "pickupLongitude"),
    dropoffName: formValue(formData, "dropoffName"),
    dropoffAddress: formValue(formData, "dropoffAddress"),
    dropoffLatitude: formValue(formData, "dropoffLatitude"),
    dropoffLongitude: formValue(formData, "dropoffLongitude"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const data = parsed.data;
  const pickup = { latitude: data.pickupLatitude, longitude: data.pickupLongitude };
  const dropoff = { latitude: data.dropoffLatitude, longitude: data.dropoffLongitude };
  const distanceKm = Math.round(haversineKm(pickup, dropoff) * 1000) / 1000;

  const database = getDatabase();
  const result = await database
    .$transaction(async (tx) => {
      // Ownership: the session user must own the order. A forged order number
      // from another account resolves to nothing.
      const order = await tx.order.findFirst({
        where: { orderNumber: data.orderNumber, customerId: actor.id },
        select: {
          id: true,
          currency: true,
          status: true,
          deliveryMethod: true,
          agricultureContracts: { select: { id: true }, take: 1 },
        },
      });
      if (!order) return { status: "not-found" as const };
      if (order.status === "CANCELLED" || order.status === "EXPIRED") {
        return { status: "closed" as const };
      }

      const existing = await tx.marketplaceTransaction.findUnique({
        where: { orderId: order.id },
        select: { transactionNumber: true },
      });
      if (existing) {
        return { status: "duplicate" as const, transactionNumber: existing.transactionNumber };
      }

      const company = await tx.logisticsCompany.findFirst({
        where: { id: data.companyId, status: "APPROVED" },
        select: { id: true, name: true },
      });
      if (!company) return { status: "company" as const };

      let service: {
        id: string;
        vendorId: string;
        currency: string;
        unitPrice: Prisma.Decimal;
        title: string;
      } | null = null;
      if (data.serviceListingId) {
        const listing = await tx.serviceListing.findFirst({
          where: { id: data.serviceListingId, status: "ACTIVE" },
          select: { id: true, vendorId: true, currency: true, unitPrice: true, title: true },
        });
        if (!listing) return { status: "service" as const };
        if (!data.scheduledAt) return { status: "schedule" as const };
        if (data.scheduledAt.getTime() <= Date.now()) return { status: "schedule" as const };
        service = listing;
      }

      const rule =
        (await tx.deliveryPricingRule.findFirst({
          where: { currency: order.currency, isActive: true },
          orderBy: { createdAt: "desc" },
        })) ?? fallbackPricingRule(order.currency);
      const fee = calculateDeliveryFee(rule, distanceKm);

      const request = await tx.deliveryRequest.create({
        data: {
          requestNumber: makeDocumentNumber("DR"),
          orderId: order.id,
          requesterId: actor.id,
          companyId: company.id,
          source: "COMPANY",
          pickupName: data.pickupName,
          pickupAddress: data.pickupAddress,
          pickupLatitude: decimal(pickup.latitude),
          pickupLongitude: decimal(pickup.longitude),
          dropoffName: data.dropoffName,
          dropoffAddress: data.dropoffAddress,
          dropoffLatitude: decimal(dropoff.latitude),
          dropoffLongitude: decimal(dropoff.longitude),
          distanceKm: decimal(distanceKm),
          fee: new Prisma.Decimal(fee.fee),
          currency: fee.currency,
          status: "PENDING",
          note: data.note ?? null,
        },
        select: { id: true, requestNumber: true },
      });

      const booking = service
        ? await tx.serviceBooking.create({
            data: {
              bookingNumber: makeDocumentNumber("SB"),
              serviceId: service.id,
              buyerId: actor.id,
              vendorId: service.vendorId,
              currency: service.currency,
              unitPrice: service.unitPrice,
              scheduledAt: data.scheduledAt!,
              status: "REQUESTED",
              note: data.note ?? null,
            },
            select: { id: true, bookingNumber: true },
          })
        : null;

      const transaction = await tx.marketplaceTransaction.create({
        data: {
          transactionNumber: makeDocumentNumber("MX"),
          customerId: actor.id,
          orderId: order.id,
          source: order.agricultureContracts.length > 0 ? "AGRICULTURE" : "RETAIL",
          currency: order.currency,
          deliveryRequestId: request.id,
          serviceBookingId: booking?.id ?? null,
          note: data.note ?? null,
        },
        select: { id: true, transactionNumber: true },
      });

      await tx.marketplaceTransactionEvent.createMany({
        data: [
          {
            transactionId: transaction.id,
            kind: "CREATED" as const,
            actorId: actor.id,
            note: null,
          },
          {
            transactionId: transaction.id,
            kind: "LOGISTICS_BOOKED" as const,
            actorId: actor.id,
            note: `${company.name} · ${request.requestNumber}`,
          },
          ...(booking
            ? [
                {
                  transactionId: transaction.id,
                  kind: "SERVICE_BOOKED" as const,
                  actorId: actor.id,
                  note: `${service!.title} · ${booking.bookingNumber}`,
                },
              ]
            : []),
        ],
      });

      await recordAuditEvent(tx, {
        actorId: actor.id,
        action: "MARKETPLACE_TRANSACTION_CREATED",
        targetType: "MarketplaceTransaction",
        targetId: transaction.id,
        metadata: {
          transactionNumber: transaction.transactionNumber,
          orderNumber: data.orderNumber,
          companyId: company.id,
          serviceBookingId: booking?.id ?? null,
        },
      });
      await appendOutboxEvent(tx, {
        eventType: "marketplace_transaction.created",
        aggregateType: "MarketplaceTransaction",
        aggregateId: transaction.id,
        payload: {
          transactionNumber: transaction.transactionNumber,
          orderNumber: data.orderNumber,
          requestNumber: request.requestNumber,
          serviceBookingId: booking?.id ?? null,
        },
      });

      return {
        status: "ok" as const,
        transactionNumber: transaction.transactionNumber,
        requestNumber: request.requestNumber,
        bookingNumber: booking?.bookingNumber ?? null,
      };
    })
    .catch((error: unknown) => {
      // The unique order_id is the last line of defence against a double submit.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: "duplicate" as const, transactionNumber: "" };
      }
      throw error;
    });

  revalidatePath(`${PATH}/${data.orderNumber}`);
  revalidatePath(`${PATH}/${data.orderNumber}/transaction`);

  if (result.status === "not-found") return fail("That order could not be found.");
  if (result.status === "closed") return fail("A cancelled or expired order cannot be booked.");
  if (result.status === "duplicate") {
    return fail(
      result.transactionNumber
        ? `This order is already connected (${result.transactionNumber}).`
        : "This order already has a transaction.",
    );
  }
  if (result.status === "company") return fail("Choose a verified logistics company.");
  if (result.status === "service") return fail("That service is no longer available.");
  if (result.status === "schedule") return fail("Choose a future time for the service.");
  return ok(`Booking created (${result.transactionNumber}).`);
}

/** Buyer cancellation. Blocked once a courier holds the job or work has started. */
export async function cancelTransactionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireActor(PATH);
  const parsed = cancelTransactionSchema.safeParse({
    transactionId: formValue(formData, "transactionId"),
    orderNumber: formValue(formData, "orderNumber"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const transaction = await tx.marketplaceTransaction.findFirst({
      where: { id: parsed.data.transactionId, customerId: actor.id },
      select: {
        id: true,
        transactionNumber: true,
        status: true,
        deliveryRequest: { select: { id: true, status: true, jobs: { select: { status: true } } } },
        serviceBooking: { select: { id: true, status: true } },
      },
    });
    if (!transaction) return "not-found" as const;

    const jobStatuses = transaction.deliveryRequest?.jobs.map((job) => job.status) ?? [];
    if (
      !canCancelTransaction({
        status: transaction.status,
        jobStatuses,
        bookingStatus: transaction.serviceBooking?.status ?? null,
      })
    ) {
      return "not-allowed" as const;
    }

    if (transaction.deliveryRequest?.status === "PENDING") {
      await tx.deliveryRequest.update({
        where: { id: transaction.deliveryRequest.id },
        data: { status: "CANCELLED" },
      });
    }
    if (
      transaction.serviceBooking &&
      (transaction.serviceBooking.status === "REQUESTED" ||
        transaction.serviceBooking.status === "CONFIRMED")
    ) {
      await tx.serviceBooking.update({
        where: { id: transaction.serviceBooking.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }

    await tx.marketplaceTransaction.update({
      where: { id: transaction.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await tx.marketplaceTransactionEvent.create({
      data: {
        transactionId: transaction.id,
        kind: "CANCELLED",
        actorId: actor.id,
        note: parsed.data.reason ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "MARKETPLACE_TRANSACTION_CANCELLED",
      targetType: "MarketplaceTransaction",
      targetId: transaction.id,
      metadata: { transactionNumber: transaction.transactionNumber },
    });
    await appendOutboxEvent(tx, {
      eventType: "marketplace_transaction.cancelled",
      aggregateType: "MarketplaceTransaction",
      aggregateId: transaction.id,
      payload: { transactionNumber: transaction.transactionNumber },
    });
    return "ok" as const;
  });

  revalidatePath(`${PATH}/${parsed.data.orderNumber}`);
  revalidatePath(`${PATH}/${parsed.data.orderNumber}/transaction`);
  if (result === "not-found") return fail("That transaction could not be found.");
  if (result === "not-allowed") {
    return fail(
      "A courier already holds this job or the work has started, so it cannot be cancelled here.",
    );
  }
  return ok("Booking cancelled.");
}

/** Buyer closes the loop once delivery arrived and any booked work finished. */
export async function completeTransactionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireActor(PATH);
  const parsed = completeTransactionSchema.safeParse({
    transactionId: formValue(formData, "transactionId"),
    orderNumber: formValue(formData, "orderNumber"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const transaction = await tx.marketplaceTransaction.findFirst({
      where: { id: parsed.data.transactionId, customerId: actor.id },
      select: {
        id: true,
        transactionNumber: true,
        status: true,
        deliveryRequest: { select: { status: true, jobs: { select: { status: true } } } },
        serviceBooking: { select: { status: true } },
      },
    });
    if (!transaction) return "not-found" as const;

    const jobStatuses = transaction.deliveryRequest?.jobs.map((job) => job.status) ?? [];
    const ready = canCompleteTransaction({
      status: transaction.status,
      jobStatuses,
      requestStatus: transaction.deliveryRequest?.status ?? null,
      bookingStatus: transaction.serviceBooking?.status ?? null,
    });
    if (!ready) return "not-ready" as const;

    await tx.marketplaceTransaction.update({
      where: { id: transaction.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await tx.marketplaceTransactionEvent.create({
      data: {
        transactionId: transaction.id,
        kind: "COMPLETED",
        actorId: actor.id,
      },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "MARKETPLACE_TRANSACTION_COMPLETED",
      targetType: "MarketplaceTransaction",
      targetId: transaction.id,
      metadata: { transactionNumber: transaction.transactionNumber },
    });
    return "ok" as const;
  });

  revalidatePath(`${PATH}/${parsed.data.orderNumber}`);
  revalidatePath(`${PATH}/${parsed.data.orderNumber}/transaction`);
  if (result === "not-found") return fail("That transaction could not be found.");
  if (result === "not-ready") {
    return fail("The delivery must arrive and any booked service must finish before this closes.");
  }
  return ok("Transaction completed.");
}
