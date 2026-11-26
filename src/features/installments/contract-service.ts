import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { recordAuditEvent } from "@/server/audit/audit-log";

/** Human-readable contract rendered from the immutable snapshot, never from live data. */
export function buildContractBody(snapshot: unknown): string {
  const value =
    snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : {};
  const seller = value.seller as Record<string, unknown> | undefined;
  const buyer = value.buyer as Record<string, unknown> | undefined;
  const item = value.item as Record<string, unknown> | undefined;
  const terms = value.terms as Record<string, unknown> | undefined;
  const schedule = Array.isArray(value.schedule) ? value.schedule : [];

  return [
    "SUPPLYHUB INSTALLMENT SALE AGREEMENT",
    "",
    `Seller: ${String(seller?.name ?? "Not recorded")} (${String(seller?.code ?? "")})`,
    `Buyer: ${String(buyer?.email ?? "Not recorded")}`,
    `Item: ${String(item?.name ?? "Not recorded")} × ${String(item?.quantity ?? "")} @ ${String(item?.unitPrice ?? "")}`,
    `Cash price: ${String(terms?.totalPayable ?? "Not recorded")} ${String(item?.currency ?? value.currency ?? "")}`,
    `Deposit: ${String(terms?.depositAmount ?? "Not recorded")}`,
    `Instalments: ${String(terms?.installmentCount ?? "")} × ${String(terms?.installmentAmount ?? "")} (${String(terms?.frequency ?? "")})`,
    `Possession: ${String(terms?.possessionModel ?? "Not recorded")}`,
    `Grace period: ${String(terms?.gracePeriodDays ?? 0)} days`,
    `Late-payment policy: ${String(terms?.latePaymentPolicy ?? "Not specified")}`,
    "",
    "Payment schedule:",
    ...schedule.map((entry) => {
      const row = entry as Record<string, unknown>;
      return `  #${String(row.sequence ?? "")} ${String(row.dueDate ?? "")} — ${String(row.amount ?? "")}`;
    }),
    "",
    "Generated from the frozen agreement snapshot. Amendment history is stored separately.",
  ].join("\n");
}

export function hashContractBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export async function createContractDocument(
  tx: Prisma.TransactionClient,
  input: { agreementId: string; actorId: string; snapshot: unknown },
): Promise<{ id: string; version: number }> {
  const agreement = await tx.installmentAgreement.findUnique({
    where: { id: input.agreementId },
    select: { termsSnapshot: true },
  });
  if (!agreement) throw new Error("Agreement not found.");
  const body = buildContractBody(agreement.termsSnapshot ?? input.snapshot);
  const latest = await tx.installmentContractDocument.findFirst({
    where: { agreementId: input.agreementId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const document = await tx.installmentContractDocument.create({
    data: {
      documentNumber: makeDocumentNumber("IC"),
      agreementId: input.agreementId,
      version,
      body,
      contentHash: hashContractBody(body),
      status: "PENDING_SIGNATURES",
      createdById: input.actorId,
    },
    select: { id: true },
  });
  await recordAuditEvent(tx, {
    actorId: input.actorId,
    action: "INSTALLMENT_CONTRACT_DOCUMENT_CREATED",
    targetType: "InstallmentContractDocument",
    targetId: document.id,
    metadata: { agreementId: input.agreementId, version, contentHash: hashContractBody(body) },
  });
  return { ...document, version };
}

export async function signContractDocument(
  tx: Prisma.TransactionClient,
  input: { documentId: string; signerUserId: string; role: "BUYER" | "SELLER" },
): Promise<"SIGNED" | "PENDING" | "ALREADY_SIGNED"> {
  const existing = await tx.installmentContractSignature.findUnique({
    where: { documentId_role: { documentId: input.documentId, role: input.role } },
    select: { id: true },
  });
  if (existing) return "ALREADY_SIGNED";

  const document = await tx.installmentContractDocument.findUnique({
    where: { id: input.documentId },
    select: { status: true, agreementId: true, contentHash: true },
  });
  if (!document || document.status === "VOID") throw new Error("Document is not signable.");

  await tx.installmentContractSignature.create({
    data: {
      documentId: input.documentId,
      signerUserId: input.signerUserId,
      role: input.role,
      method: "ACCOUNT_SESSION",
      evidenceHash: createHash("sha256")
        .update(`${document.contentHash}:${input.signerUserId}:${input.role}`)
        .digest("hex"),
    },
  });
  const signatures = await tx.installmentContractSignature.count({
    where: { documentId: input.documentId },
  });
  const fullySigned = signatures >= 2;
  await tx.installmentContractDocument.update({
    where: { id: input.documentId },
    data: { status: fullySigned ? "SIGNED" : "PENDING_SIGNATURES" },
  });
  await recordAuditEvent(tx, {
    actorId: input.signerUserId,
    action: "INSTALLMENT_CONTRACT_SIGNED",
    targetType: "InstallmentContractDocument",
    targetId: input.documentId,
    metadata: { agreementId: document.agreementId, role: input.role, fullySigned },
  });
  return fullySigned ? "SIGNED" : "PENDING";
}
