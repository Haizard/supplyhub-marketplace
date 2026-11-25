"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";
import { getPaymentGateway } from "@/server/payments/gateway";
import type { LynxPayPaymentMethod } from "@/server/payments/types";

import { authorizeInstallmentSeller } from "./access";
import { applyVerifiedInstallmentPayment, refundInstallmentPayment } from "./payment-service";
import { toMinor } from "./payment-rules";
import {
  recordInstallmentCashSchema,
  refundInstallmentSchema,
  startInstallmentPaymentSchema,
} from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}
const sellerPath = (businessId: string) => `/business/${businessId}/installments`;

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase10.installmentSales"))) {
    return fail("Installment sales are not enabled yet.");
  }
  return null;
}

/** Buyer starts a payment. Success here means PENDING — only a verified callback pays. */
export async function startInstallmentPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = startInstallmentPaymentSchema.safeParse({
    agreementId: formValue(formData, "agreementId"),
    amount: formValue(formData, "amount"),
    method: formValue(formData, "method"),
    phone: formValue(formData, "phone"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const actor = await requireActor("/account/installments");
  const database = getDatabase();
  const agreement = await database.installmentAgreement.findFirst({
    where: { id: parsed.data.agreementId, buyerUserId: actor.id },
    select: {
      id: true,
      businessId: true,
      currency: true,
      status: true,
      outstandingBalance: true,
      buyerUserId: true,
      business: { select: { name: true } },
    },
  });
  if (!agreement) return fail("Agreement not found.");
  if (!["PENDING_DEPOSIT", "ACTIVE", "OVERDUE"].includes(agreement.status)) {
    return fail("This agreement is not accepting payments.");
  }

  const settings = await database.installmentSetting.findUnique({
    where: { businessId: agreement.businessId },
    select: { allowAdvancePayments: true },
  });
  const outstandingMinor = toMinor(Number(agreement.outstandingBalance.toString()));
  const amountMinor = toMinor(parsed.data.amount);
  if (amountMinor > outstandingMinor && settings?.allowAdvancePayments !== true) {
    return fail("Payment exceeds the outstanding balance and advance payments are not enabled.");
  }

  const reference = makeDocumentNumber("IP");
  const businessName = agreement.business.name;
  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");

  const paymentId = await database.$transaction(async (tx) => {
    const payment = await tx.installmentPayment.create({
      data: {
        reference,
        agreementId: agreement.id,
        buyerUserId: actor.id,
        amount: new Prisma.Decimal(parsed.data.amount),
        currency: agreement.currency,
        method: parsed.data.method,
        status: "PENDING",
        createdById: actor.id,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "INSTALLMENT_PAYMENT_STARTED",
      targetType: "InstallmentPayment",
      targetId: payment.id,
      metadata: {
        agreementId: agreement.id,
        reference,
        amountMinor,
        currency: agreement.currency,
        method: parsed.data.method,
      },
    });
    return payment.id;
  });

  try {
    const gateway = getPaymentGateway();
    const providerPayment = await gateway.createPayment({
      amountMinor,
      currency: agreement.currency,
      phone: parsed.data.phone,
      method: parsed.data.method.toLowerCase() as LynxPayPaymentMethod,
      externalId: reference,
      description: `Installment ${agreement.id.slice(0, 8)} — ${businessName}`,
      callbackUrl: `${siteUrl}/account/installments/${agreement.id}?payment=return`,
      metadata: { installmentPaymentId: paymentId, agreementId: agreement.id },
      idempotencyKey: reference,
    });
    await database.installmentPayment.update({
      where: { id: paymentId },
      data: {
        provider: gateway.provider,
        providerPaymentId: providerPayment.providerPaymentId,
        providerReference: providerPayment.providerReference,
        checkoutUrl: providerPayment.checkoutUrl,
        status: "PENDING",
      },
    });
  } catch (error) {
    logger.warn("installment.payment_start_failed", {
      paymentId,
      message: error instanceof Error ? error.message : "unknown error",
    });
    await database.installmentPayment.update({
      where: { id: paymentId },
      data: { failureReason: "Provider did not confirm payment start; awaiting callback." },
    });
    return fail("The payment provider did not confirm payment start. No money was recorded.");
  }

  revalidatePath(`/account/installments/${agreement.id}`);
  return ok(
    "Payment initiated. Complete it with the provider; it is recorded only after a verified callback.",
  );
}

/** Seller-attested offline payment (cash/bank). Audited and allocated immediately. */
export async function recordInstallmentCashPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = recordInstallmentCashSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    agreementId: formValue(formData, "agreementId"),
    amount: formValue(formData, "amount"),
    method: formValue(formData, "method"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeInstallmentSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);

  const database = getDatabase();
  const agreement = await database.installmentAgreement.findFirst({
    where: { id: parsed.data.agreementId, businessId: parsed.data.businessId },
    select: { id: true, currency: true, status: true, outstandingBalance: true, buyerUserId: true },
  });
  if (!agreement) return fail("Agreement not found for this business.");
  if (!["PENDING_DEPOSIT", "ACTIVE", "OVERDUE"].includes(agreement.status)) {
    return fail("This agreement is not accepting payments.");
  }

  const settings = await database.installmentSetting.findUnique({
    where: { businessId: parsed.data.businessId },
    select: { allowAdvancePayments: true },
  });
  if (
    toMinor(parsed.data.amount) > toMinor(Number(agreement.outstandingBalance.toString())) &&
    settings?.allowAdvancePayments !== true
  ) {
    return fail("Payment exceeds the outstanding balance and advance payments are not enabled.");
  }

  const payment = await database.installmentPayment.create({
    data: {
      reference: makeDocumentNumber("IC"),
      agreementId: agreement.id,
      buyerUserId: agreement.buyerUserId,
      amount: new Prisma.Decimal(parsed.data.amount),
      currency: agreement.currency,
      method: parsed.data.method,
      status: "PENDING",
      createdById: access.actor.id,
      failureReason: parsed.data.note ?? null,
    },
    select: { id: true },
  });

  const result = await applyVerifiedInstallmentPayment({
    paymentId: payment.id,
    paidAt: new Date(),
    verifiedById: access.actor.id,
  });
  if (result !== "APPLIED") return fail(`The payment could not be recorded (${result}).`);

  revalidatePath(sellerPath(parsed.data.businessId));
  revalidatePath("/account/installments");
  return ok("Offline payment attested, verified and allocated to the schedule.");
}

/** Refunds a verified payment through the provider (when applicable) and reverses allocations. */
export async function refundInstallmentPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = refundInstallmentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    paymentId: formValue(formData, "paymentId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeInstallmentSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);

  const payment = await getDatabase().installmentPayment.findFirst({
    where: {
      id: parsed.data.paymentId,
      agreement: { businessId: parsed.data.businessId },
      status: "VERIFIED",
    },
    select: { id: true, providerPaymentId: true, provider: true, amount: true, agreementId: true },
  });
  if (!payment) return fail("No verified payment was found for this business.");

  const gateway = getPaymentGateway();
  const result = await refundInstallmentPayment({
    paymentId: payment.id,
    actorId: access.actor.id,
    reason: parsed.data.reason,
    providerRefund:
      payment.providerPaymentId && payment.provider
        ? async (providerPaymentId, amountMinor, reason) => {
            await gateway.refundPayment(providerPaymentId, amountMinor, reason);
          }
        : undefined,
  });
  if (result !== "REFUNDED") {
    return fail("The refund could not be completed; no entries were changed.");
  }

  revalidatePath(sellerPath(parsed.data.businessId));
  revalidatePath("/account/installments");
  return ok("Payment refunded and its allocations reversed.");
}
