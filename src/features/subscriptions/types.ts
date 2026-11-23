import type {
  BusinessSubscriptionStatus,
  SubscriptionInvoiceStatus,
  SubscriptionPlanStatus,
} from "@/generated/prisma/enums";

export interface SubscriptionPlanView {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: string;
  currency: string;
  includedSeats: number;
  seatLimit: number;
  features: string[];
  status: SubscriptionPlanStatus;
  sortOrder: number;
}

export interface SubscriptionInvoiceView {
  id: string;
  invoiceNumber: string;
  status: SubscriptionInvoiceStatus;
  currency: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}

export interface BusinessSubscriptionView {
  id: string;
  businessId: string;
  status: BusinessSubscriptionStatus;
  seats: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  canceledAt: string | null;
  plan: SubscriptionPlanView;
  invoices: SubscriptionInvoiceView[];
}
