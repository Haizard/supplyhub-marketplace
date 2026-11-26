import "server-only";

import { getDatabase } from "@/server/db/client";

export interface ListingView {
  id: string;
  cropName: string;
  variety: string | null;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  minimumOrder: string;
  grade: string | null;
  collectionLocation: string;
  deliveryAvailable: boolean;
  organicClaim: boolean;
  certifiedClaim: boolean;
  status: string;
  farmerName: string;
  verificationStatus: string;
}

export interface BuyerRequestView {
  id: string;
  productName: string;
  quantity: string;
  unit: string;
  qualitySpec: string | null;
  deliveryLocation: string;
  deliveryDeadline: string;
  offerDeadline: string;
  status: string;
}

export interface OfferView {
  id: string;
  cropName: string;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  status: string;
  buyerRequestId: string | null;
  createdAt: string;
}

export interface ContractView {
  id: string;
  contractNumber: string;
  cropName: string;
  quantity: string;
  unit: string;
  total: string;
  currency: string;
  status: string;
  orderNumber: string | null;
  paymentStatus: string | null;
  createdAt: string;
}

export async function listPublishedListings(): Promise<ListingView[]> {
  const rows = await getDatabase().agriculturalListing.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      cropName: true,
      variety: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      currency: true,
      minimumOrder: true,
      grade: true,
      collectionLocation: true,
      deliveryAvailable: true,
      organicClaim: true,
      certifiedClaim: true,
      status: true,
      farmer: { select: { user: { select: { name: true } }, verificationStatus: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    cropName: row.cropName,
    variety: row.variety,
    quantity: row.quantity.toString(),
    unit: row.unit,
    pricePerUnit: row.pricePerUnit.toString(),
    currency: row.currency,
    minimumOrder: row.minimumOrder.toString(),
    grade: row.grade,
    collectionLocation: row.collectionLocation,
    deliveryAvailable: row.deliveryAvailable,
    organicClaim: row.organicClaim,
    certifiedClaim: row.certifiedClaim,
    status: row.status,
    farmerName: row.farmer.user.name,
    verificationStatus: row.farmer.verificationStatus,
  }));
}

export async function listOpenBuyerRequests(): Promise<BuyerRequestView[]> {
  const rows = await getDatabase().agriculturalBuyerRequest.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    productName: row.productName,
    quantity: row.quantity.toString(),
    unit: row.unit,
    qualitySpec: row.qualitySpec,
    deliveryLocation: row.deliveryLocation,
    deliveryDeadline: row.deliveryDeadline.toISOString(),
    offerDeadline: row.offerDeadline.toISOString(),
    status: row.status,
  }));
}

export async function listFarmerOffers(farmerId: string): Promise<OfferView[]> {
  const rows = await getDatabase().agriculturalOffer.findMany({
    where: { farmerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      requestId: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      currency: true,
      status: true,
      createdAt: true,
      listing: { select: { cropName: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    cropName: row.listing.cropName,
    quantity: row.quantity.toString(),
    unit: row.unit,
    pricePerUnit: row.pricePerUnit.toString(),
    currency: row.currency,
    status: row.status,
    buyerRequestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listBuyerOffers(buyerUserId: string): Promise<OfferView[]> {
  const rows = await getDatabase().agriculturalOffer.findMany({
    where: { buyerUserId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      requestId: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      currency: true,
      status: true,
      createdAt: true,
      listing: { select: { cropName: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    cropName: row.listing.cropName,
    quantity: row.quantity.toString(),
    unit: row.unit,
    pricePerUnit: row.pricePerUnit.toString(),
    currency: row.currency,
    status: row.status,
    buyerRequestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listContracts(scope: {
  farmerId?: string;
  buyerUserId?: string;
}): Promise<ContractView[]> {
  const rows = await getDatabase().agriculturalContract.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      contractNumber: true,
      quantity: true,
      unit: true,
      total: true,
      currency: true,
      status: true,
      createdAt: true,
      order: {
        select: {
          orderNumber: true,
          payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    contractNumber: row.contractNumber,
    cropName: "",
    quantity: row.quantity.toString(),
    unit: row.unit,
    total: row.total.toString(),
    currency: row.currency,
    status: row.status,
    orderNumber: row.order?.orderNumber ?? null,
    paymentStatus: row.order?.payments[0]?.status ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPendingFarmers() {
  const rows = await getDatabase().agricultureFarmer.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      region: true,
      district: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.user.name,
    email: row.user.email,
    region: row.region,
    district: row.district,
  }));
}

export async function getFarmerSummary(userId: string) {
  const farmer = await getDatabase().agricultureFarmer.findUnique({
    where: { userId },
    select: {
      id: true,
      verificationStatus: true,
      region: true,
      district: true,
      farms: {
        select: {
          id: true,
          name: true,
          sizeValue: true,
          sizeUnit: true,
          plots: { select: { id: true, name: true, sizeValue: true, sizeUnit: true } },
        },
      },
      listings: { select: { id: true, cropName: true, quantity: true, unit: true, status: true } },
    },
  });
  return farmer;
}
