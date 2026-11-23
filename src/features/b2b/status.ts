import type {
  InvoiceStatus,
  PurchaseOrderStatus,
  QuotationStatus,
  RfqStatus,
} from "@/generated/prisma/enums";

/** Forward-only transitions for each B2B document, defined once for actions and UI. */
export const RFQ_TRANSITIONS: Readonly<Record<RfqStatus, readonly RfqStatus[]>> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["QUOTED", "REJECTED", "CANCELLED", "EXPIRED"],
  QUOTED: ["ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const QUOTATION_TRANSITIONS: Readonly<Record<QuotationStatus, readonly QuotationStatus[]>> =
  {
    DRAFT: ["SENT"],
    SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
    ACCEPTED: [],
    REJECTED: [],
    EXPIRED: [],
  };

export const PURCHASE_ORDER_TRANSITIONS: Readonly<
  Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]>
> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["RECEIVED"],
  RECEIVED: [],
  CANCELLED: [],
};

export const INVOICE_TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "OVERDUE", "CANCELLED"],
  OVERDUE: ["PAID"],
  PAID: [],
  CANCELLED: [],
};

function canMove<T extends string>(
  map: Readonly<Record<T, readonly T[]>>,
  from: T,
  to: T,
): boolean {
  return map[from].includes(to);
}

export const canTransitionRfq = (from: RfqStatus, to: RfqStatus) =>
  canMove(RFQ_TRANSITIONS, from, to);
export const canTransitionQuotation = (from: QuotationStatus, to: QuotationStatus) =>
  canMove(QUOTATION_TRANSITIONS, from, to);
export const canTransitionPurchaseOrder = (from: PurchaseOrderStatus, to: PurchaseOrderStatus) =>
  canMove(PURCHASE_ORDER_TRANSITIONS, from, to);
export const canTransitionInvoice = (from: InvoiceStatus, to: InvoiceStatus) =>
  canMove(INVOICE_TRANSITIONS, from, to);

export const RFQ_LABELS: Record<RfqStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting quote",
  QUOTED: "Quoted",
  ACCEPTED: "Accepted",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};
export const QUOTATION_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Declined",
  EXPIRED: "Expired",
};
export const PURCHASE_ORDER_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};
export const INVOICE_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};
