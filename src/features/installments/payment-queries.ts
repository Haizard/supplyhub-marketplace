import "server-only";

import { getDatabase } from "@/server/db/client";

export interface InstallmentPaymentView {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  paidAt: string | null;
  verifiedAt: string | null;
  failureReason: string | null;
  checkoutUrl: string | null;
  receipt: { id: string; receiptNumber: string; issuedAt: string } | null;
  allocations: { sequence: number; amount: string }[];
}

export async function listAgreementPayments(
  agreementId: string,
  scope: { buyerUserId?: string; businessId?: string },
): Promise<InstallmentPaymentView[]> {
  const rows = await getDatabase().installmentPayment.findMany({
    where: {
      agreementId,
      ...(scope.buyerUserId ? { buyerUserId: scope.buyerUserId } : {}),
      ...(scope.businessId ? { agreement: { businessId: scope.businessId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      reference: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      paidAt: true,
      verifiedAt: true,
      failureReason: true,
      checkoutUrl: true,
      receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
      allocations: {
        select: { amount: true, schedule: { select: { sequence: true } } },
        orderBy: { schedule: { sequence: "asc" } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    amount: row.amount.toString(),
    currency: row.currency,
    method: row.method,
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    checkoutUrl: row.checkoutUrl,
    receipt: row.receipt
      ? {
          id: row.receipt.id,
          receiptNumber: row.receipt.receiptNumber,
          issuedAt: row.receipt.issuedAt.toISOString(),
        }
      : null,
    allocations: row.allocations.map((allocation) => ({
      sequence: allocation.schedule.sequence,
      amount: allocation.amount.toString(),
    })),
  }));
}
