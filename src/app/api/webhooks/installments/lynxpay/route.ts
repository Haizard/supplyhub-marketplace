import { Prisma } from "@/generated/prisma/client";
import { connection, NextResponse } from "next/server";

import { isFeatureEnabled } from "@/features/flags/service";
import { sanitizePaymentPayload } from "@/features/payments/events";
import {
  applyVerifiedInstallmentPayment,
  type VerificationResult,
} from "@/features/installments/payment-service";
import { getDatabase } from "@/server/db/client";
import { getLynxPayConfig, PaymentConfigurationError } from "@/server/payments/config";
import { lynxPayPaymentSchema, toGatewayPayment } from "@/server/payments/lynxpay/schema";
import { verifyLynxPayWebhook, webhookDeliveryId } from "@/server/payments/lynxpay/webhook";
import { recordAuditEvent } from "@/server/audit/audit-log";

const MAX_BODY_BYTES = 64 * 1024;
const PROVIDER = "LYNXPAY";

/** Verified LynxPay callbacks are the only source of payment truth for installments. */
export async function POST(request: Request): Promise<Response> {
  await connection();

  if (!(await isFeatureEnabled("phase10.installmentSales"))) {
    return NextResponse.json({ error: "Installment sales are not enabled." }, { status: 503 });
  }

  let config;
  try {
    config = getLynxPayConfig();
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      return NextResponse.json(
        { error: "Webhook verification is not configured." },
        { status: 503 },
      );
    }
    throw error;
  }
  if (!config.webhookSecret) {
    return NextResponse.json({ error: "Webhook verification is not configured." }, { status: 503 });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const verified = verifyLynxPayWebhook({
    rawBody,
    timestamp: request.headers.get("x-lynx-timestamp"),
    signature: request.headers.get("x-lynx-signature"),
    previousSignature: request.headers.get("x-lynx-signature-previous"),
    secret: config.webhookSecret,
    previousSecret: config.webhookSecretPrevious,
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = lynxPayPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment payload." }, { status: 400 });
  }

  const payment = toGatewayPayment(parsed.data);
  const deliveryId = webhookDeliveryId(request.headers.get("x-lynx-delivery"), rawBody);
  const eventType = (request.headers.get("x-lynx-event") ?? "payment.updated").slice(0, 64);
  const payload = sanitizePaymentPayload(payment);
  const database = getDatabase();

  let eventId: string;
  try {
    const event = await database.installmentPaymentEvent.create({
      data: {
        provider: PROVIDER,
        deliveryId,
        eventType,
        outcome: "IGNORED",
        status: payment.status,
        payload,
      },
      select: { id: true },
    });
    eventId = event.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, outcome: "DUPLICATE" });
    }
    throw error;
  }

  const finish = async (
    outcome: "APPLIED" | "DUPLICATE" | "MISMATCH" | "IGNORED" | "ERROR",
    paymentId?: string,
    agreementId?: string,
  ) => {
    await database.installmentPaymentEvent.update({
      where: { id: eventId },
      data: {
        outcome,
        paymentId: paymentId ?? null,
        agreementId: agreementId ?? null,
        processedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, outcome });
  };

  const local = payment.externalId
    ? await database.installmentPayment.findUnique({
        where: { reference: payment.externalId },
        select: {
          id: true,
          agreementId: true,
          status: true,
          amount: true,
          currency: true,
          providerPaymentId: true,
        },
      })
    : null;

  if (!local) {
    return finish("IGNORED");
  }

  const amountMatches =
    Number(local.amount.toString()) * 100 === payment.amountMinor &&
    local.currency.toUpperCase() === payment.currency.toUpperCase();
  if (!amountMatches) {
    await recordAuditEvent(database, {
      actorId: null,
      action: "INSTALLMENT_PAYMENT_MISMATCH",
      targetType: "InstallmentPayment",
      targetId: local.id,
      metadata: {
        agreementId: local.agreementId,
        expectedMinor: Math.round(Number(local.amount.toString()) * 100),
        receivedMinor: payment.amountMinor,
        currency: payment.currency,
      },
    });
    await database.installmentPayment.update({
      where: { id: local.id },
      data: { status: "FAILED", failureReason: "Provider amount or currency did not match." },
    });
    return finish("MISMATCH", local.id, local.agreementId);
  }

  let outcome: VerificationResult | "IGNORED" = "IGNORED";
  if (payment.status === "completed") {
    outcome = await applyVerifiedInstallmentPayment({
      paymentId: local.id,
      providerPaymentId: payment.providerPaymentId,
      providerReference: payment.providerReference,
      paidAt: payment.completedAt,
    });
  } else if (payment.status === "failed" || payment.status === "expired") {
    await database.installmentPayment.update({
      where: { id: local.id },
      data: {
        status: "FAILED",
        failureReason: payment.failureReason ?? `Provider status: ${payment.status}`,
      },
    });
  }

  const finalOutcome = outcome === "NOT_FOUND" ? "IGNORED" : outcome;
  return finish(finalOutcome, local.id, local.agreementId);
}
