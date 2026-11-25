import type { LogisticsContractStatus, LogisticsInvoiceStatus } from "@/generated/prisma/enums";

export const CONTRACT_TRANSITIONS: Readonly<
  Record<LogisticsContractStatus, readonly LogisticsContractStatus[]>
> = {
  DRAFT: ["PROPOSED", "ACTIVE"],
  PROPOSED: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["SUSPENDED", "EXPIRED", "TERMINATED"],
  SUSPENDED: ["ACTIVE", "EXPIRED", "TERMINATED"],
  EXPIRED: [],
  TERMINATED: [],
};

export function canTransitionContract(
  from: LogisticsContractStatus,
  to: LogisticsContractStatus,
): boolean {
  return CONTRACT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const INVOICE_TRANSITIONS: Readonly<
  Record<LogisticsInvoiceStatus, readonly LogisticsInvoiceStatus[]>
> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "OVERDUE", "CANCELLED"],
  OVERDUE: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export function canTransitionInvoice(
  from: LogisticsInvoiceStatus,
  to: LogisticsInvoiceStatus,
): boolean {
  return INVOICE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const CONTRACT_STATUS_LABELS: Record<LogisticsContractStatus, string> = {
  DRAFT: "Draft",
  PROPOSED: "Proposed",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
};

export const INVOICE_STATUS_LABELS: Record<LogisticsInvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};
