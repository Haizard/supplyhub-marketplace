import "server-only";

import type {
  InvoiceStatus,
  PurchaseOrderStatus,
  QuotationStatus,
  RfqStatus,
  WholesaleListingStatus,
} from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface WholesaleListingView {
  id: string;
  listingNumber: string;
  vendorId: string;
  vendorName: string;
  title: string;
  sku: string;
  currency: string;
  unitPrice: string;
  minimumOrder: number;
  stockAvailable: number;
  leadTimeDays: number;
  status: WholesaleListingStatus;
  tiers: { minQty: number; maxQty: number | null; unitPrice: string }[];
}

export interface RfqView {
  id: string;
  rfqNumber: string;
  buyerBusinessId: string;
  supplierVendorId: string;
  supplierName: string;
  status: RfqStatus;
  currency: string;
  note: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  itemCount: number;
  quotationCount: number;
}

export interface RfqDetail extends RfqView {
  items: {
    id: string;
    productName: string;
    sku: string | null;
    quantity: number;
    unit: string;
    targetPrice: string | null;
    note: string | null;
  }[];
  quotations: {
    id: string;
    quotationNumber: string;
    status: QuotationStatus;
    subtotal: string;
    currency: string;
    sentAt: Date | null;
    itemCount: number;
  }[];
}

export interface QuotationView {
  id: string;
  quotationNumber: string;
  rfqId: string;
  rfqNumber: string;
  supplierVendorId: string;
  supplierName: string;
  buyerBusinessId: string;
  status: QuotationStatus;
  currency: string;
  subtotal: string;
  note: string | null;
  sentAt: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  itemCount: number;
}

export interface QuotationDetail extends QuotationView {
  items: {
    id: string;
    rfqItemId: string;
    productName: string;
    sku: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    note: string | null;
  }[];
}

export interface PurchaseOrderView {
  id: string;
  poNumber: string;
  businessId: string;
  supplierVendorId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  currency: string;
  total: string;
  orderedAt: Date | null;
  createdAt: Date;
  itemCount: number;
}

export interface PurchaseOrderDetail extends PurchaseOrderView {
  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  note: string | null;
  quotationNumber: string | null;
  items: {
    id: string;
    productName: string;
    sku: string | null;
    quantity: number;
    receivedQuantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
}

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  purchaseOrderId: string;
  poNumber: string;
  businessId: string;
  supplierVendorId: string;
  supplierName: string;
  status: InvoiceStatus;
  currency: string;
  total: string;
  amountPaid: string;
  dueAt: Date | null;
  issuedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface InvoiceDetail extends InvoiceView {
  subtotal: string;
  taxTotal: string;
  note: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
}

const listingSelect = {
  id: true,
  listingNumber: true,
  vendorId: true,
  title: true,
  sku: true,
  currency: true,
  unitPrice: true,
  minimumOrder: true,
  stockAvailable: true,
  leadTimeDays: true,
  status: true,
  vendor: { select: { name: true } },
  priceTiers: {
    orderBy: { minQty: "asc" },
    select: { minQty: true, maxQty: true, unitPrice: true },
  },
} as const;

function mapListing(row: {
  id: string;
  listingNumber: string;
  vendorId: string;
  title: string;
  sku: string;
  currency: string;
  unitPrice: { toString(): string };
  minimumOrder: number;
  stockAvailable: number;
  leadTimeDays: number;
  status: WholesaleListingStatus;
  vendor: { name: string };
  priceTiers: { minQty: number; maxQty: number | null; unitPrice: { toString(): string } }[];
}): WholesaleListingView {
  return {
    id: row.id,
    listingNumber: row.listingNumber,
    vendorId: row.vendorId,
    vendorName: row.vendor.name,
    title: row.title,
    sku: row.sku,
    currency: row.currency,
    unitPrice: row.unitPrice.toString(),
    minimumOrder: row.minimumOrder,
    stockAvailable: row.stockAvailable,
    leadTimeDays: row.leadTimeDays,
    status: row.status,
    tiers: row.priceTiers.map((t) => ({
      minQty: t.minQty,
      maxQty: t.maxQty,
      unitPrice: t.unitPrice.toString(),
    })),
  };
}

export async function listActiveWholesaleListings(): Promise<WholesaleListingView[]> {
  const rows = await getDatabase().wholesaleListing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { publishedAt: "desc" },
    select: listingSelect,
  });
  return rows.map(mapListing);
}

export async function listVendorWholesaleListings(
  vendorId: string,
): Promise<WholesaleListingView[]> {
  const rows = await getDatabase().wholesaleListing.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
    select: listingSelect,
  });
  return rows.map(mapListing);
}

const rfqSelect = {
  id: true,
  rfqNumber: true,
  buyerBusinessId: true,
  supplierVendorId: true,
  status: true,
  currency: true,
  note: true,
  submittedAt: true,
  createdAt: true,
  supplierVendor: { select: { name: true } },
  _count: { select: { items: true, quotations: true } },
} as const;

type RfqRow = {
  id: string;
  rfqNumber: string;
  buyerBusinessId: string;
  supplierVendorId: string;
  status: RfqStatus;
  currency: string;
  note: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  supplierVendor: { name: string };
  _count: { items: number; quotations: number };
};

function mapRfq(row: RfqRow): RfqView {
  return {
    id: row.id,
    rfqNumber: row.rfqNumber,
    buyerBusinessId: row.buyerBusinessId,
    supplierVendorId: row.supplierVendorId,
    supplierName: row.supplierVendor.name,
    status: row.status,
    currency: row.currency,
    note: row.note,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    itemCount: row._count.items,
    quotationCount: row._count.quotations,
  };
}

export async function listBuyerRfqs(businessId: string): Promise<RfqView[]> {
  const rows = await getDatabase().rfq.findMany({
    where: { buyerBusinessId: businessId },
    orderBy: { createdAt: "desc" },
    select: rfqSelect,
  });
  return rows.map(mapRfq);
}

export async function listSupplierRfqs(vendorId: string): Promise<RfqView[]> {
  const rows = await getDatabase().rfq.findMany({
    where: { supplierVendorId: vendorId, status: { in: ["SUBMITTED", "QUOTED"] } },
    orderBy: { submittedAt: "desc" },
    select: rfqSelect,
  });
  return rows.map(mapRfq);
}

export async function getRfq(
  rfqId: string,
  scope: { buyerBusinessId?: string; supplierVendorId?: string },
): Promise<RfqDetail | null> {
  const row = await getDatabase().rfq.findFirst({
    where: { id: rfqId, ...scope },
    select: {
      ...rfqSelect,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productName: true,
          sku: true,
          quantity: true,
          unit: true,
          targetPrice: true,
          note: true,
        },
      },
      quotations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          subtotal: true,
          currency: true,
          sentAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapRfq(row),
    items: row.items.map((item) => ({
      ...item,
      targetPrice: item.targetPrice ? item.targetPrice.toString() : null,
    })),
    quotations: row.quotations.map((quote) => ({
      id: quote.id,
      quotationNumber: quote.quotationNumber,
      status: quote.status,
      subtotal: quote.subtotal.toString(),
      currency: quote.currency,
      sentAt: quote.sentAt,
      itemCount: quote._count.items,
    })),
  };
}

const quotationSelect = {
  id: true,
  quotationNumber: true,
  rfqId: true,
  supplierVendorId: true,
  businessId: true,
  status: true,
  currency: true,
  subtotal: true,
  note: true,
  sentAt: true,
  validUntil: true,
  createdAt: true,
  supplierVendor: { select: { name: true } },
  rfq: { select: { rfqNumber: true, buyerBusinessId: true } },
  _count: { select: { items: true } },
} as const;

type QuotationRow = {
  id: string;
  quotationNumber: string;
  rfqId: string;
  supplierVendorId: string;
  businessId: string | null;
  status: QuotationStatus;
  currency: string;
  subtotal: { toString(): string };
  note: string | null;
  sentAt: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  supplierVendor: { name: string };
  rfq: { rfqNumber: string; buyerBusinessId: string };
  _count: { items: number };
};

function mapQuotation(row: QuotationRow): QuotationView {
  return {
    id: row.id,
    quotationNumber: row.quotationNumber,
    rfqId: row.rfqId,
    rfqNumber: row.rfq.rfqNumber,
    supplierVendorId: row.supplierVendorId,
    supplierName: row.supplierVendor.name,
    buyerBusinessId: row.rfq.buyerBusinessId,
    status: row.status,
    currency: row.currency,
    subtotal: row.subtotal.toString(),
    note: row.note,
    sentAt: row.sentAt,
    validUntil: row.validUntil,
    createdAt: row.createdAt,
    itemCount: row._count.items,
  };
}

export async function listBuyerQuotations(businessId: string): Promise<QuotationView[]> {
  const rows = await getDatabase().supplierQuotation.findMany({
    where: { rfq: { buyerBusinessId: businessId } },
    orderBy: { createdAt: "desc" },
    select: quotationSelect,
  });
  return rows.map(mapQuotation);
}

export async function listSupplierQuotations(vendorId: string): Promise<QuotationView[]> {
  const rows = await getDatabase().supplierQuotation.findMany({
    where: { supplierVendorId: vendorId },
    orderBy: { createdAt: "desc" },
    select: quotationSelect,
  });
  return rows.map(mapQuotation);
}

export async function getQuotation(
  quotationId: string,
  scope: { buyerBusinessId?: string; supplierVendorId?: string },
): Promise<QuotationDetail | null> {
  const row = await getDatabase().supplierQuotation.findFirst({
    where: {
      id: quotationId,
      ...(scope.buyerBusinessId ? { rfq: { buyerBusinessId: scope.buyerBusinessId } } : {}),
      ...(scope.supplierVendorId ? { supplierVendorId: scope.supplierVendorId } : {}),
    },
    select: {
      ...quotationSelect,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          rfqItemId: true,
          productName: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          note: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapQuotation(row),
    items: row.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  };
}

const poSelect = {
  id: true,
  poNumber: true,
  businessId: true,
  supplierVendorId: true,
  status: true,
  currency: true,
  total: true,
  orderedAt: true,
  createdAt: true,
  supplierVendor: { select: { name: true } },
  _count: { select: { items: true } },
} as const;

type PoRow = {
  id: string;
  poNumber: string;
  businessId: string;
  supplierVendorId: string;
  status: PurchaseOrderStatus;
  currency: string;
  total: { toString(): string };
  orderedAt: Date | null;
  createdAt: Date;
  supplierVendor: { name: string };
  _count: { items: number };
};

function mapPo(row: PoRow): PurchaseOrderView {
  return {
    id: row.id,
    poNumber: row.poNumber,
    businessId: row.businessId,
    supplierVendorId: row.supplierVendorId,
    supplierName: row.supplierVendor.name,
    status: row.status,
    currency: row.currency,
    total: row.total.toString(),
    orderedAt: row.orderedAt,
    createdAt: row.createdAt,
    itemCount: row._count.items,
  };
}

export async function listBusinessPurchaseOrders(businessId: string): Promise<PurchaseOrderView[]> {
  const rows = await getDatabase().businessPurchaseOrder.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: poSelect,
  });
  return rows.map(mapPo);
}

export async function listSupplierPurchaseOrders(vendorId: string): Promise<PurchaseOrderView[]> {
  const rows = await getDatabase().businessPurchaseOrder.findMany({
    where: { supplierVendorId: vendorId },
    orderBy: { createdAt: "desc" },
    select: poSelect,
  });
  return rows.map(mapPo);
}

export async function getPurchaseOrder(
  poId: string,
  scope: { businessId?: string; supplierVendorId?: string },
): Promise<PurchaseOrderDetail | null> {
  const row = await getDatabase().businessPurchaseOrder.findFirst({
    where: { id: poId, ...scope },
    select: {
      ...poSelect,
      subtotal: true,
      taxTotal: true,
      shippingTotal: true,
      note: true,
      quotation: { select: { quotationNumber: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productName: true,
          sku: true,
          quantity: true,
          receivedQuantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapPo(row),
    subtotal: row.subtotal.toString(),
    taxTotal: row.taxTotal.toString(),
    shippingTotal: row.shippingTotal.toString(),
    note: row.note,
    quotationNumber: row.quotation?.quotationNumber ?? null,
    items: row.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  };
}

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  purchaseOrderId: true,
  businessId: true,
  supplierVendorId: true,
  status: true,
  currency: true,
  total: true,
  amountPaid: true,
  dueAt: true,
  issuedAt: true,
  paidAt: true,
  createdAt: true,
  supplierVendor: { select: { name: true } },
  purchaseOrder: { select: { poNumber: true } },
} as const;

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  purchaseOrderId: string;
  businessId: string;
  supplierVendorId: string;
  status: InvoiceStatus;
  currency: string;
  total: { toString(): string };
  amountPaid: { toString(): string };
  dueAt: Date | null;
  issuedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  supplierVendor: { name: string };
  purchaseOrder: { poNumber: string };
};

function mapInvoice(row: InvoiceRow): InvoiceView {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    purchaseOrderId: row.purchaseOrderId,
    poNumber: row.purchaseOrder.poNumber,
    businessId: row.businessId,
    supplierVendorId: row.supplierVendorId,
    supplierName: row.supplierVendor.name,
    status: row.status,
    currency: row.currency,
    total: row.total.toString(),
    amountPaid: row.amountPaid.toString(),
    dueAt: row.dueAt,
    issuedAt: row.issuedAt,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  };
}

export async function listBusinessInvoices(businessId: string): Promise<InvoiceView[]> {
  const rows = await getDatabase().businessInvoice.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: invoiceSelect,
  });
  return rows.map(mapInvoice);
}

export async function listSupplierInvoices(vendorId: string): Promise<InvoiceView[]> {
  const rows = await getDatabase().businessInvoice.findMany({
    where: { supplierVendorId: vendorId },
    orderBy: { createdAt: "desc" },
    select: invoiceSelect,
  });
  return rows.map(mapInvoice);
}

export async function getInvoice(
  invoiceId: string,
  scope: { businessId?: string; supplierVendorId?: string },
): Promise<InvoiceDetail | null> {
  const row = await getDatabase().businessInvoice.findFirst({
    where: { id: invoiceId, ...scope },
    select: {
      ...invoiceSelect,
      subtotal: true,
      taxTotal: true,
      note: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapInvoice(row),
    subtotal: row.subtotal.toString(),
    taxTotal: row.taxTotal.toString(),
    note: row.note,
    items: row.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  };
}

export interface SupplierOption {
  id: string;
  name: string;
}

/** Approved vendors that a buyer may address in an RFQ or purchase order. */
export async function listApprovedSuppliers(): Promise<SupplierOption[]> {
  return getDatabase().vendor.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

/** Products a seller can attach to a wholesale listing. */
export async function listVendorProducts(vendorId: string): Promise<ProductOption[]> {
  return getDatabase().product.findMany({
    where: { vendorId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true },
  });
}

/** Accepted quotations available as the basis for a buyer purchase order. */
export async function listAcceptedQuotations(
  businessId: string,
): Promise<{ id: string; quotationNumber: string; supplierName: string; total: string }[]> {
  const rows = await getDatabase().supplierQuotation.findMany({
    where: { status: "ACCEPTED", rfq: { buyerBusinessId: businessId } },
    orderBy: { acceptedAt: "desc" },
    select: {
      id: true,
      quotationNumber: true,
      subtotal: true,
      supplierVendor: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    quotationNumber: row.quotationNumber,
    supplierName: row.supplierVendor.name,
    total: row.subtotal.toString(),
  }));
}
