import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { recordAuditEvent } from "@/server/audit/audit-log";

import { formatReceiptAmount } from "./overdue-rules";

/** Idempotent: one receipt per verified payment, including cash/bank. */
export async function issueInstallmentReceipt(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; agreementId: string; buyerUserId: string; actorId?: string | null },
): Promise<void> {
  const receipt = await tx.installmentReceipt.upsert({
    where: { paymentId: input.paymentId },
    create: {
      receiptNumber: makeDocumentNumber("IR"),
      paymentId: input.paymentId,
      agreementId: input.agreementId,
      buyerUserId: input.buyerUserId,
    },
    update: {},
    select: { id: true, receiptNumber: true },
  });
  await recordAuditEvent(tx, {
    actorId: input.actorId ?? null,
    action: "INSTALLMENT_RECEIPT_ISSUED",
    targetType: "InstallmentReceipt",
    targetId: receipt.id,
    metadata: {
      agreementId: input.agreementId,
      paymentId: input.paymentId,
      receiptNumber: receipt.receiptNumber,
    },
  });
}

export function buildReceiptText(input: {
  receiptNumber: string;
  agreementNumber: string;
  amount: string;
  currency: string;
  method: string;
  paidAt: string | null;
  sellerName: string;
  buyerEmail: string;
}): string {
  return [
    "SUPPLYHUB — INSTALLMENT PAYMENT RECEIPT",
    "----------------------------------------",
    `Receipt: ${input.receiptNumber}`,
    `Agreement: ${input.agreementNumber}`,
    `Seller: ${input.sellerName}`,
    `Buyer: ${input.buyerEmail}`,
    `Amount: ${formatReceiptAmount(input.amount, input.currency)}`,
    `Method: ${input.method}`,
    `Paid at: ${input.paidAt ?? "not recorded"}`,
    "",
    "This receipt is generated from the frozen agreement record.",
  ].join("\n");
}
