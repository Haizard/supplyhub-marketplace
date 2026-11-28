import "server-only";

import type { ServiceBookingStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface ServiceListingView {
  id: string;
  listingNumber: string;
  vendorId: string;
  vendorName: string;
  title: string;
  description: string;
  currency: string;
  unitPrice: string;
  durationMinutes: number;
  location: string;
  coverImageUrl: string | null;
  status: string;
  publishedAt: string | null;
  /** True only when a reviewer approved the studio's provider application. */
  providerVerified: boolean;
}

export interface ServiceBookingView {
  id: string;
  bookingNumber: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  vendorId: string;
  vendorName: string;
  currency: string;
  unitPrice: string;
  scheduledAt: string;
  status: ServiceBookingStatus;
  note: string | null;
}

type ListingRow = {
  id: string;
  listingNumber: string;
  vendorId: string;
  vendor: { name: string; providerApplication: { status: string } | null };
  title: string;
  description: string;
  currency: string;
  unitPrice: { toString(): string };
  durationMinutes: number;
  location: string;
  coverImageUrl: string | null;
  status: string;
  publishedAt: Date | null;
};

function toListingView(row: ListingRow): ServiceListingView {
  return {
    id: row.id,
    listingNumber: row.listingNumber,
    vendorId: row.vendorId,
    vendorName: row.vendor.name,
    title: row.title,
    description: row.description,
    currency: row.currency,
    unitPrice: row.unitPrice.toString(),
    durationMinutes: row.durationMinutes,
    location: row.location,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    providerVerified: row.vendor.providerApplication?.status === "APPROVED",
  };
}

type BookingRow = {
  id: string;
  bookingNumber: string;
  serviceId: string;
  service: { title: string };
  buyerId: string;
  buyer: { name: string };
  vendorId: string;
  vendor: { name: string };
  currency: string;
  unitPrice: { toString(): string };
  scheduledAt: Date;
  status: ServiceBookingStatus;
  note: string | null;
};

function toBookingView(row: BookingRow): ServiceBookingView {
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    listingId: row.serviceId,
    listingTitle: row.service.title,
    buyerId: row.buyerId,
    buyerName: row.buyer.name,
    vendorId: row.vendorId,
    vendorName: row.vendor.name,
    currency: row.currency,
    unitPrice: row.unitPrice.toString(),
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    note: row.note,
  };
}

export async function listActiveServiceListings(): Promise<ServiceListingView[]> {
  const rows = await getDatabase().serviceListing.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      vendor: { select: { name: true, providerApplication: { select: { status: true } } } },
    },
  });
  return rows.map(toListingView);
}

export async function getActiveServiceListing(id: string): Promise<ServiceListingView | null> {
  const row = await getDatabase().serviceListing.findFirst({
    where: { id, status: "ACTIVE" },
    include: {
      vendor: { select: { name: true, providerApplication: { select: { status: true } } } },
    },
  });
  return row ? toListingView(row) : null;
}

export async function listVendorServiceListings(vendorId: string): Promise<ServiceListingView[]> {
  const rows = await getDatabase().serviceListing.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { name: true, providerApplication: { select: { status: true } } } },
    },
  });
  return rows.map(toListingView);
}

export async function listVendorServiceBookings(vendorId: string): Promise<ServiceBookingView[]> {
  const rows = await getDatabase().serviceBooking.findMany({
    where: { vendorId },
    orderBy: { scheduledAt: "desc" },
    include: {
      service: { select: { title: true } },
      buyer: { select: { name: true } },
      vendor: { select: { name: true } },
    },
  });
  return rows.map(toBookingView);
}

export async function getVendorServiceListing(
  id: string,
  vendorId: string,
): Promise<ServiceListingView | null> {
  const row = await getDatabase().serviceListing.findFirst({
    where: { id, vendorId },
    include: {
      vendor: { select: { name: true, providerApplication: { select: { status: true } } } },
    },
  });
  return row ? toListingView(row) : null;
}

export async function listBuyerServiceBookings(buyerId: string): Promise<ServiceBookingView[]> {
  const rows = await getDatabase().serviceBooking.findMany({
    where: { buyerId },
    orderBy: { scheduledAt: "desc" },
    include: {
      service: { select: { title: true } },
      buyer: { select: { name: true } },
      vendor: { select: { name: true } },
    },
  });
  return rows.map(toBookingView);
}
