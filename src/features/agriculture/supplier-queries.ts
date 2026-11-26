import "server-only";

import { getDatabase } from "@/server/db/client";

export interface InputView {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  minimumOrder: string;
  treatmentStatus: string | null;
  registrationRef: string | null;
  organicClaim: boolean;
  supplierName: string;
  verificationStatus: string;
}

export interface ServiceView {
  id: string;
  serviceType: string;
  title: string;
  rateAmount: string;
  rateUnit: string;
  currency: string;
  serviceArea: string | null;
  qualificationRef: string | null;
  supplierName: string;
  verificationStatus: string;
}

export interface BookingView {
  id: string;
  bookingNumber: string;
  serviceTitle: string;
  status: string;
  requestedFor: string;
  scheduledAt: string | null;
  quoteAmount: string | null;
  currency: string;
  quoteNote: string | null;
}

export interface InputOrderView {
  id: string;
  inputName: string;
  quantity: string;
  unit: string;
  total: string;
  currency: string;
  status: string;
  paymentStatus: string | null;
  createdAt: string;
}

export async function listPublishedInputs(): Promise<InputView[]> {
  const rows = await getDatabase().agriculturalInput.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      category: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      currency: true,
      minimumOrder: true,
      treatmentStatus: true,
      registrationRef: true,
      organicClaim: true,
      supplier: { select: { businessName: true, verificationStatus: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity.toString(),
    unit: row.unit,
    pricePerUnit: row.pricePerUnit.toString(),
    currency: row.currency,
    minimumOrder: row.minimumOrder.toString(),
    treatmentStatus: row.treatmentStatus,
    registrationRef: row.registrationRef,
    organicClaim: row.organicClaim,
    supplierName: row.supplier.businessName,
    verificationStatus: row.supplier.verificationStatus,
  }));
}

export async function listPublishedServices(): Promise<ServiceView[]> {
  const rows = await getDatabase().agriculturalService.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      serviceType: true,
      title: true,
      rateAmount: true,
      rateUnit: true,
      currency: true,
      serviceArea: true,
      qualificationRef: true,
      supplier: { select: { businessName: true, verificationStatus: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    serviceType: row.serviceType,
    title: row.title,
    rateAmount: row.rateAmount.toString(),
    rateUnit: row.rateUnit,
    currency: row.currency,
    serviceArea: row.serviceArea,
    qualificationRef: row.qualificationRef,
    supplierName: row.supplier.businessName,
    verificationStatus: row.supplier.verificationStatus,
  }));
}

function toBooking(row: {
  id: string;
  bookingNumber: string;
  status: string;
  requestedFor: Date;
  scheduledAt: Date | null;
  quoteAmount: { toString(): string } | null;
  currency: string;
  quoteNote: string | null;
  service: { title: string };
}): BookingView {
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    serviceTitle: row.service.title,
    status: row.status,
    requestedFor: row.requestedFor.toISOString(),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    quoteAmount: row.quoteAmount?.toString() ?? null,
    currency: row.currency,
    quoteNote: row.quoteNote,
  };
}

const bookingSelect = {
  id: true,
  bookingNumber: true,
  status: true,
  requestedFor: true,
  scheduledAt: true,
  quoteAmount: true,
  currency: true,
  quoteNote: true,
  service: { select: { title: true } },
} as const;

export async function listSupplierBookings(supplierId: string): Promise<BookingView[]> {
  const rows = await getDatabase().agriculturalServiceBooking.findMany({
    where: { supplierId },
    orderBy: { requestedFor: "desc" },
    take: 100,
    select: bookingSelect,
  });
  return rows.map(toBooking);
}

export async function listFarmerBookings(farmerId: string): Promise<BookingView[]> {
  const rows = await getDatabase().agriculturalServiceBooking.findMany({
    where: { farmerId },
    orderBy: { requestedFor: "desc" },
    take: 100,
    select: bookingSelect,
  });
  return rows.map(toBooking);
}

export async function listInputOrders(scope: {
  farmerId?: string;
  supplierId?: string;
}): Promise<InputOrderView[]> {
  const rows = await getDatabase().agriculturalInputOrder.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      quantity: true,
      unit: true,
      total: true,
      currency: true,
      status: true,
      createdAt: true,
      input: { select: { name: true } },
      order: {
        select: { payments: { select: { status: true }, take: 1, orderBy: { createdAt: "desc" } } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    inputName: row.input.name,
    quantity: row.quantity.toString(),
    unit: row.unit,
    total: row.total.toString(),
    currency: row.currency,
    status: row.status,
    paymentStatus: row.order?.payments[0]?.status ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getSupplierProfile(userId: string) {
  return getDatabase().agriculturalSupplier.findUnique({ where: { userId } });
}

export async function listPendingSuppliers() {
  const rows = await getDatabase().agriculturalSupplier.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      businessName: true,
      type: true,
      user: { select: { name: true, email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    businessName: row.businessName,
    type: row.type,
    name: row.user.name,
    email: row.user.email,
  }));
}
