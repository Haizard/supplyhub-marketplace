import { connection } from "next/server";

import { isFeatureEnabled } from "@/features/flags/service";
import { buildReceiptText } from "@/features/installments/receipt-service";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

function snapshotValue(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "Not recorded";
  const entry = (value as Record<string, unknown>)[key];
  if (!entry || typeof entry !== "object") return "Not recorded";
  const field = (entry as Record<string, unknown>).name ?? (entry as Record<string, unknown>).email;
  return typeof field === "string" ? field : "Not recorded";
}

/** Buyer-only downloadable receipt. Never cached or shared between tenants. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
): Promise<Response> {
  await connection();

  if (!(await isFeatureEnabled("phase10.installmentSales"))) {
    return Response.json({ error: "Installment sales not enabled." }, { status: 503 });
  }
  const actor = await getSessionActor();
  if (!actor) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  const { receiptId } = await params;
  const receipt = await getDatabase().installmentReceipt.findFirst({
    where: { id: receiptId, buyerUserId: actor.id },
    select: {
      receiptNumber: true,
      issuedAt: true,
      payment: {
        select: {
          amount: true,
          currency: true,
          method: true,
          paidAt: true,
          status: true,
        },
      },
      agreement: {
        select: {
          agreementNumber: true,
          termsSnapshot: true,
        },
      },
    },
  });
  if (!receipt || receipt.payment.status !== "VERIFIED") {
    return Response.json({ error: "Receipt not found." }, { status: 404 });
  }

  const text = buildReceiptText({
    receiptNumber: receipt.receiptNumber,
    agreementNumber: receipt.agreement.agreementNumber,
    amount: receipt.payment.amount.toString(),
    currency: receipt.payment.currency,
    method: receipt.payment.method,
    paidAt: receipt.payment.paidAt?.toISOString() ?? null,
    sellerName: snapshotValue(receipt.agreement.termsSnapshot, "seller"),
    buyerEmail: snapshotValue(receipt.agreement.termsSnapshot, "buyer"),
  });

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${receipt.receiptNumber}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
