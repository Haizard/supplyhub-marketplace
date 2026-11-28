import "server-only";

import type { MarketplaceTransactionStatus } from "@/generated/prisma/enums";
import { canViewCustomerOrder } from "@/server/auth/policies";
import type { Actor } from "@/server/auth/actor";
import { getDatabase } from "@/server/db/client";

import {
  canCancelTransaction,
  canCompleteTransaction,
  deriveTransactionStatus,
  type TransactionTimelineSource,
} from "./status";

export interface TransactionTimelineEntry {
  id: string;
  source: TransactionTimelineSource;
  kind: string;
  note: string | null;
  at: string;
}

export interface MarketplaceTransactionView {
  id: string;
  transactionNumber: string;
  status: MarketplaceTransactionStatus;
  source: "RETAIL" | "AGRICULTURE";
  currency: string;
  createdAt: string;
  note: string | null;
  canCancel: boolean;
  canComplete: boolean;
  orderNumber: string;
  logistics: {
    requestNumber: string;
    companyName: string | null;
    status: string;
    jobStatus: string | null;
    fee: string;
    currency: string;
    distanceKm: string;
    pickupAddress: string;
    dropoffAddress: string;
  } | null;
  service: {
    bookingNumber: string;
    title: string;
    vendorName: string;
    status: string;
    scheduledAt: string;
    unitPrice: string;
    currency: string;
  } | null;
  timeline: TransactionTimelineEntry[];
}

/**
 * Loads the transaction for one order and builds the single timeline from all
 * three legs: the transaction's own events, the courier's append-only status
 * history, and the service booking's lifecycle.
 *
 * Ownership is checked against the order's customer, so another account (or a
 * guessed order number) gets null and the page renders 404.
 */
export async function getTransactionForOrder(
  actor: Actor,
  orderNumber: string,
): Promise<MarketplaceTransactionView | null> {
  const database = getDatabase();
  const order = await database.order.findUnique({
    where: { orderNumber },
    select: { id: true, customerId: true },
  });
  if (!order || !canViewCustomerOrder(actor, order.customerId)) return null;

  const row = await database.marketplaceTransaction.findUnique({
    where: { orderId: order.id },
    select: {
      id: true,
      transactionNumber: true,
      status: true,
      source: true,
      currency: true,
      createdAt: true,
      note: true,
      events: {
        select: { id: true, kind: true, note: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      deliveryRequest: {
        select: {
          requestNumber: true,
          companyId: true,
          status: true,
          fee: true,
          currency: true,
          distanceKm: true,
          pickupAddress: true,
          dropoffAddress: true,
          jobs: {
            select: {
              id: true,
              status: true,
              assignedAt: true,
              statusHistory: {
                select: { id: true, toStatus: true, note: true, createdAt: true },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { assignedAt: "asc" },
          },
        },
      },
      serviceBooking: {
        select: {
          bookingNumber: true,
          status: true,
          scheduledAt: true,
          unitPrice: true,
          currency: true,
          createdAt: true,
          confirmedAt: true,
          completedAt: true,
          cancelledAt: true,
          service: { select: { title: true, vendor: { select: { name: true } } } },
        },
      },
    },
  });
  if (!row) return null;

  const company = row.deliveryRequest?.companyId
    ? await database.logisticsCompany.findUnique({
        where: { id: row.deliveryRequest.companyId },
        select: { name: true },
      })
    : null;

  const jobStatuses = row.deliveryRequest?.jobs.map((job) => job.status) ?? [];
  const bookingStatus = row.serviceBooking?.status ?? null;
  const status = deriveTransactionStatus({ stored: row.status, jobStatuses, bookingStatus });

  const timeline: TransactionTimelineEntry[] = [
    ...row.events.map((event) => ({
      id: `event-${event.id}`,
      source: "TRANSACTION" as const,
      kind: event.kind,
      note: event.note,
      at: event.createdAt.toISOString(),
    })),
    ...(row.deliveryRequest?.jobs ?? []).flatMap((job) => {
      const history: TransactionTimelineEntry[] = job.statusHistory.map((entry) => ({
        id: `job-${entry.id}`,
        source: "LOGISTICS",
        kind: entry.toStatus,
        note: entry.note,
        at: entry.createdAt.toISOString(),
      }));
      // A job created by accepting an offer starts at ASSIGNED without a
      // history row, so the shared timeline backfills that first step.
      if (!job.statusHistory.some((entry) => entry.toStatus === "ASSIGNED")) {
        history.unshift({
          id: `job-assigned-${job.id}`,
          source: "LOGISTICS",
          kind: "ASSIGNED",
          note: null,
          at: job.assignedAt.toISOString(),
        });
      }
      return history;
    }),
    ...(row.serviceBooking
      ? [
          {
            id: `booking-${row.serviceBooking.bookingNumber}`,
            source: "SERVICE" as const,
            kind: row.serviceBooking.status,
            note: null,
            at: (
              row.serviceBooking.completedAt ??
              row.serviceBooking.cancelledAt ??
              row.serviceBooking.confirmedAt ??
              row.serviceBooking.createdAt
            ).toISOString(),
          },
        ]
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return {
    id: row.id,
    transactionNumber: row.transactionNumber,
    status,
    source: row.source,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    note: row.note,
    canCancel: canCancelTransaction({ status: row.status, jobStatuses, bookingStatus }),
    canComplete: canCompleteTransaction({
      status: row.status,
      jobStatuses,
      requestStatus: row.deliveryRequest?.status ?? null,
      bookingStatus,
    }),
    orderNumber,
    logistics: row.deliveryRequest
      ? {
          requestNumber: row.deliveryRequest.requestNumber,
          companyName: company?.name ?? null,
          status: row.deliveryRequest.status,
          jobStatus: jobStatuses[0] ?? null,
          fee: row.deliveryRequest.fee.toString(),
          currency: row.deliveryRequest.currency,
          distanceKm: row.deliveryRequest.distanceKm.toString(),
          pickupAddress: row.deliveryRequest.pickupAddress,
          dropoffAddress: row.deliveryRequest.dropoffAddress,
        }
      : null,
    service: row.serviceBooking
      ? {
          bookingNumber: row.serviceBooking.bookingNumber,
          title: row.serviceBooking.service.title,
          vendorName: row.serviceBooking.service.vendor.name,
          status: row.serviceBooking.status,
          scheduledAt: row.serviceBooking.scheduledAt.toISOString(),
          unitPrice: row.serviceBooking.unitPrice.toString(),
          currency: row.serviceBooking.currency,
        }
      : null,
    timeline,
  };
}

/** True when this order already has a combined transaction. */
export async function orderHasTransaction(orderId: string): Promise<boolean> {
  const row = await getDatabase().marketplaceTransaction.findUnique({
    where: { orderId },
    select: { id: true },
  });
  return Boolean(row);
}
