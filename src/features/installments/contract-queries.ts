import "server-only";

import { getDatabase } from "@/server/db/client";

export interface ContractDocumentView {
  id: string;
  documentNumber: string;
  version: number;
  status: string;
  body: string;
  contentHash: string;
  signatures: { role: string; signerName: string; signedAt: string }[];
}

export interface AmendmentView {
  id: string;
  amendmentNumber: string;
  version: number;
  reason: string;
  status: string;
  createdAt: string;
}

export interface FinancingApplicationView {
  id: string;
  applicationNumber: string;
  partnerCode: string;
  requestedAmount: string;
  currency: string;
  status: string;
  offeredAmount: string | null;
  acceptedAt: string | null;
  fundedAt: string | null;
  providerReference: string | null;
  createdAt: string;
}

export async function listContractDocuments(agreementId: string): Promise<ContractDocumentView[]> {
  const rows = await getDatabase().installmentContractDocument.findMany({
    where: { agreementId },
    orderBy: { version: "asc" },
    select: {
      id: true,
      documentNumber: true,
      version: true,
      status: true,
      body: true,
      contentHash: true,
      signatures: {
        select: { role: true, signedAt: true, signer: { select: { name: true } } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    documentNumber: row.documentNumber,
    version: row.version,
    status: row.status,
    body: row.body,
    contentHash: row.contentHash,
    signatures: row.signatures.map((signature) => ({
      role: signature.role,
      signerName: signature.signer.name,
      signedAt: signature.signedAt.toISOString(),
    })),
  }));
}

export async function listInstallmentAmendments(agreementId: string): Promise<AmendmentView[]> {
  const rows = await getDatabase().installmentAmendment.findMany({
    where: { agreementId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amendmentNumber: true,
      version: true,
      reason: true,
      status: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    amendmentNumber: row.amendmentNumber,
    version: row.version,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listFinancingApplications(
  agreementId: string,
): Promise<FinancingApplicationView[]> {
  const rows = await getDatabase().installmentFinancingApplication.findMany({
    where: { agreementId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      applicationNumber: true,
      partnerCode: true,
      requestedAmount: true,
      currency: true,
      status: true,
      offeredAmount: true,
      acceptedAt: true,
      fundedAt: true,
      providerReference: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    applicationNumber: row.applicationNumber,
    partnerCode: row.partnerCode,
    requestedAmount: row.requestedAmount.toString(),
    currency: row.currency,
    status: row.status,
    offeredAmount: row.offeredAmount?.toString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    fundedAt: row.fundedAt?.toISOString() ?? null,
    providerReference: row.providerReference,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listAllInstallmentFinancingApplications(): Promise<
  (FinancingApplicationView & { buyerEmail: string; sellerName: string })[]
> {
  const rows = await getDatabase().installmentFinancingApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      applicationNumber: true,
      partnerCode: true,
      requestedAmount: true,
      currency: true,
      status: true,
      offeredAmount: true,
      acceptedAt: true,
      fundedAt: true,
      providerReference: true,
      createdAt: true,
      agreement: {
        select: {
          buyer: { select: { email: true } },
          business: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    applicationNumber: row.applicationNumber,
    partnerCode: row.partnerCode,
    requestedAmount: row.requestedAmount.toString(),
    currency: row.currency,
    status: row.status,
    offeredAmount: row.offeredAmount?.toString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    fundedAt: row.fundedAt?.toISOString() ?? null,
    providerReference: row.providerReference,
    createdAt: row.createdAt.toISOString(),
    buyerEmail: row.agreement.buyer.email,
    sellerName: row.agreement.business.name,
  }));
}
