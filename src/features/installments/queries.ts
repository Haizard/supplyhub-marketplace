import "server-only";

import { getDatabase } from "@/server/db/client";

export interface InstallmentSettingsView {
  businessId: string;
  enabled: boolean;
  currency: string;
  defaultDepositMode: string;
  defaultDepositValue: string;
  defaultFrequency: string;
  defaultInstallmentCount: number;
  defaultPossession: string;
  gracePeriodDays: number;
  allowInterest: boolean;
  allowLateFees: boolean;
  allowAdvancePayments: boolean;
  maxInstallments: number;
  termsSummary: string | null;
}

export interface AgreementSummary {
  id: string;
  agreementNumber: string;
  counterpartyName: string;
  status: string;
  currency: string;
  cashPrice: string;
  depositAmount: string;
  outstandingBalance: string;
  nextDueDate: string | null;
  createdAt: string;
}

export interface InstallmentItemView {
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface InstallmentScheduleView {
  sequence: number;
  dueDate: string;
  amount: string;
  currency: string;
  status: string;
  paidAmount: string;
}

export interface InstallmentEventView {
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
}

export interface AgreementDetail extends AgreementSummary {
  source: string;
  possessionModel: string;
  frequency: string;
  installmentCount: number;
  installmentAmount: string;
  totalPayable: string;
  depositMode: string;
  gracePeriodDays: number;
  latePaymentPolicy: string | null;
  notes: string | null;
  buyerAcceptedAt: string | null;
  buyerAcceptanceMethod: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  items: InstallmentItemView[];
  schedule: InstallmentScheduleView[];
  events: InstallmentEventView[];
  termsSnapshot: unknown;
}

export async function getInstallmentSettings(
  businessId: string,
): Promise<InstallmentSettingsView | null> {
  const row = await getDatabase().installmentSetting.findUnique({ where: { businessId } });
  if (!row) return null;
  return {
    businessId: row.businessId,
    enabled: row.enabled,
    currency: row.currency,
    defaultDepositMode: row.defaultDepositMode,
    defaultDepositValue: row.defaultDepositValue.toString(),
    defaultFrequency: row.defaultFrequency,
    defaultInstallmentCount: row.defaultInstallmentCount,
    defaultPossession: row.defaultPossession,
    gracePeriodDays: row.gracePeriodDays,
    allowInterest: row.allowInterest,
    allowLateFees: row.allowLateFees,
    allowAdvancePayments: row.allowAdvancePayments,
    maxInstallments: row.maxInstallments,
    termsSummary: row.termsSummary,
  };
}

function toSummary(row: {
  id: string;
  agreementNumber: string;
  status: string;
  currency: string;
  cashPrice: { toString(): string };
  depositAmount: { toString(): string };
  outstandingBalance: { toString(): string };
  createdAt: Date;
  schedule: { dueDate: Date }[];
  business: { name: string };
  buyer: { email: string };
}): AgreementSummary {
  return {
    id: row.id,
    agreementNumber: row.agreementNumber,
    counterpartyName: row.business.name,
    status: row.status,
    currency: row.currency,
    cashPrice: row.cashPrice.toString(),
    depositAmount: row.depositAmount.toString(),
    outstandingBalance: row.outstandingBalance.toString(),
    nextDueDate:
      row.schedule.find((entry) => entry.dueDate.getTime() > Date.now())?.dueDate.toISOString() ??
      null,
    createdAt: row.createdAt.toISOString(),
  };
}

const summarySelect = {
  id: true,
  agreementNumber: true,
  status: true,
  currency: true,
  cashPrice: true,
  depositAmount: true,
  outstandingBalance: true,
  createdAt: true,
  schedule: {
    where: { status: "PENDING" },
    select: { dueDate: true },
    orderBy: { sequence: "asc" },
  },
  business: { select: { name: true } },
  buyer: { select: { email: true } },
} as const;

export async function listSellerInstallments(businessId: string): Promise<AgreementSummary[]> {
  const rows = await getDatabase().installmentAgreement.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: summarySelect,
  });
  return rows.map((row) => ({
    ...toSummary(row),
    counterpartyName: row.buyer.email,
  }));
}

export async function listBuyerInstallments(buyerUserId: string): Promise<AgreementSummary[]> {
  const rows = await getDatabase().installmentAgreement.findMany({
    where: { buyerUserId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: summarySelect,
  });
  return rows.map(toSummary);
}

export async function getBuyerAgreementDetail(
  buyerUserId: string,
  agreementId: string,
): Promise<AgreementDetail | null> {
  const row = await getDatabase().installmentAgreement.findFirst({
    where: { id: agreementId, buyerUserId },
    select: {
      ...summarySelect,
      source: true,
      possessionModel: true,
      frequency: true,
      installmentCount: true,
      installmentAmount: true,
      totalPayable: true,
      depositMode: true,
      gracePeriodDays: true,
      latePaymentPolicy: true,
      notes: true,
      buyerAcceptedAt: true,
      buyerAcceptanceMethod: true,
      cancelledAt: true,
      cancellationReason: true,
      termsSnapshot: true,
      schedule: {
        select: {
          sequence: true,
          dueDate: true,
          amount: true,
          currency: true,
          status: true,
          paidAmount: true,
        },
        orderBy: { sequence: "asc" },
      },
      items: {
        select: { productName: true, sku: true, quantity: true, unitPrice: true, lineTotal: true },
      },
      events: {
        select: { type: true, fromStatus: true, toStatus: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) return null;
  return {
    ...toSummary(row),
    counterpartyName: row.business.name,
    source: row.source,
    possessionModel: row.possessionModel,
    frequency: row.frequency,
    installmentCount: row.installmentCount,
    installmentAmount: row.installmentAmount.toString(),
    totalPayable: row.totalPayable.toString(),
    depositMode: row.depositMode,
    gracePeriodDays: row.gracePeriodDays,
    latePaymentPolicy: row.latePaymentPolicy,
    notes: row.notes,
    buyerAcceptedAt: row.buyerAcceptedAt?.toISOString() ?? null,
    buyerAcceptanceMethod: row.buyerAcceptanceMethod,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    items: row.items.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
    schedule: row.schedule.map((entry) => ({
      sequence: entry.sequence,
      dueDate: entry.dueDate.toISOString(),
      amount: entry.amount.toString(),
      currency: entry.currency,
      status: entry.status,
      paidAmount: entry.paidAmount.toString(),
    })),
    events: row.events.map((event) => ({
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt.toISOString(),
    })),
    termsSnapshot: row.termsSnapshot,
  };
}
