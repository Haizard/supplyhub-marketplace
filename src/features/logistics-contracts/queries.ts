import "server-only";

import type { LogisticsContractStatus, LogisticsInvoiceStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface ContractView {
  id: string;
  contractNumber: string;
  clientId: string;
  clientName: string;
  title: string;
  type: string;
  status: LogisticsContractStatus;
  version: number;
  currency: string;
  startsAt: string;
  endsAt: string | null;
  monthlyAllocation: number | null;
  deliveredCount: number;
  invoiceCount: number;
}

export interface ContractDetailView extends ContractView {
  description: string;
  coverageArea: string;
  serviceHours: string;
  paymentTerms: string;
  pricing: {
    mode: string;
    perDelivery: string | null;
    monthlyFee: string | null;
    perKmRate: string | null;
    minimumFee: string | null;
    includedUnits: number | null;
  } | null;
  sla: {
    maxDeliveryHours: number | null;
    minCompletionRateBps: number | null;
    proofRequired: boolean;
    otpRequired: boolean;
    claimsWindowDays: number | null;
  } | null;
  deliveries: {
    id: string;
    reference: string;
    status: string;
    charge: string;
    deliveredAt: string | null;
  }[];
  invoices: { id: string; invoiceNumber: string; status: LogisticsInvoiceStatus; total: string }[];
  versions: { id: string; version: number; status: LogisticsContractStatus; createdAt: string }[];
}

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  contractId: string;
  contractNumber: string;
  clientName: string;
  status: LogisticsInvoiceStatus;
  currency: string;
  total: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export async function listContracts(companyId: string): Promise<ContractView[]> {
  const rows = await getDatabase().logisticsContract.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      contractNumber: true,
      clientId: true,
      title: true,
      type: true,
      status: true,
      version: true,
      currency: true,
      startsAt: true,
      endsAt: true,
      monthlyAllocation: true,
      client: { select: { name: true } },
      _count: { select: { deliveries: true, invoices: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    contractNumber: row.contractNumber,
    clientId: row.clientId,
    clientName: row.client.name,
    title: row.title,
    type: row.type,
    status: row.status,
    version: row.version,
    currency: row.currency,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    monthlyAllocation: row.monthlyAllocation,
    deliveredCount: row._count.deliveries,
    invoiceCount: row._count.invoices,
  }));
}

export async function getContractDetail(
  contractId: string,
  companyId: string,
): Promise<ContractDetailView | null> {
  const row = await getDatabase().logisticsContract.findFirst({
    where: { id: contractId, companyId },
    select: {
      id: true,
      contractNumber: true,
      clientId: true,
      title: true,
      description: true,
      type: true,
      status: true,
      version: true,
      previousVersionId: true,
      currency: true,
      startsAt: true,
      endsAt: true,
      monthlyAllocation: true,
      coverageArea: true,
      serviceHours: true,
      paymentTerms: true,
      client: { select: { name: true } },
      pricing: true,
      sla: true,
      deliveries: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, status: true, charge: true, deliveredAt: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: { id: true, invoiceNumber: true, status: true, total: true },
      },
    },
  });
  if (!row) return null;

  const versions = await getDatabase().logisticsContract.findMany({
    where: {
      companyId,
      clientId: row.clientId,
      OR: [{ id: row.id }, { previousVersionId: row.id }, { id: row.previousVersionId ?? "" }],
    },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true, createdAt: true },
  });

  return {
    id: row.id,
    contractNumber: row.contractNumber,
    clientId: row.clientId,
    clientName: row.client.name,
    title: row.title,
    description: row.description ?? "",
    type: row.type,
    status: row.status,
    version: row.version,
    currency: row.currency,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    monthlyAllocation: row.monthlyAllocation,
    coverageArea: row.coverageArea ?? "",
    serviceHours: row.serviceHours ?? "",
    paymentTerms: row.paymentTerms ?? "",
    deliveredCount: row.deliveries.length,
    invoiceCount: row.invoices.length,
    pricing: row.pricing
      ? {
          mode: row.pricing.mode,
          perDelivery: row.pricing.perDelivery?.toString() ?? null,
          monthlyFee: row.pricing.monthlyFee?.toString() ?? null,
          perKmRate: row.pricing.perKmRate?.toString() ?? null,
          minimumFee: row.pricing.minimumFee?.toString() ?? null,
          includedUnits: row.pricing.includedUnits,
        }
      : null,
    sla: row.sla
      ? {
          maxDeliveryHours: row.sla.maxDeliveryHours,
          minCompletionRateBps: row.sla.minCompletionRateBps,
          proofRequired: row.sla.proofRequired,
          otpRequired: row.sla.otpRequired,
          claimsWindowDays: row.sla.claimsWindowDays,
        }
      : null,
    deliveries: row.deliveries.map((delivery) => ({
      id: delivery.id,
      reference: delivery.reference,
      status: delivery.status,
      charge: delivery.charge.toString(),
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    })),
    invoices: row.invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      total: invoice.total.toString(),
    })),
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

export async function listInvoices(companyId: string): Promise<InvoiceView[]> {
  const rows = await getDatabase().logisticsInvoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      contractId: true,
      status: true,
      currency: true,
      total: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      contract: { select: { contractNumber: true, client: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    contractId: row.contractId,
    contractNumber: row.contract.contractNumber,
    clientName: row.contract.client.name,
    status: row.status,
    currency: row.currency,
    total: row.total.toString(),
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}
