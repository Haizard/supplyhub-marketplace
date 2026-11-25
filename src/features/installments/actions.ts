"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { calculateInstallmentTerms, InstallmentTermsError, type ScheduleEntry } from "./rules";
import {
  holdInstallmentStock,
  InstallmentStockError,
  releaseInstallmentStock,
} from "./stock-service";
import { authorizeInstallmentSeller } from "./access";
import {
  acceptInstallmentSchema,
  cancelInstallmentSchema,
  createInstallmentAgreementSchema,
  installmentSettingsSchema,
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
const decimal = (value: number) => new Prisma.Decimal(value);
const sellerPath = (businessId: string) => `/business/${businessId}/installments`;

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase10.installmentSales"))) {
    return fail("Installment sales are not enabled yet.");
  }
  return null;
}

async function authorizeSeller(
  businessId: string,
): Promise<{ actorId: string } | { error: string }> {
  const access = await authorizeInstallmentSeller(businessId, sellerPath(businessId));
  return "error" in access ? access : { actorId: access.actor.id };
}

/** Seller-controlled defaults. Legally sensitive levers stay recorded but unused. */
export async function saveInstallmentSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = installmentSettingsSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    enabled: formValue(formData, "enabled"),
    currency: formValue(formData, "currency"),
    defaultDepositMode: formValue(formData, "defaultDepositMode"),
    defaultDepositValue: formValue(formData, "defaultDepositValue"),
    defaultFrequency: formValue(formData, "defaultFrequency"),
    defaultInstallmentCount: formValue(formData, "defaultInstallmentCount"),
    defaultPossession: formValue(formData, "defaultPossession"),
    gracePeriodDays: formValue(formData, "gracePeriodDays"),
    maxInstallments: formValue(formData, "maxInstallments"),
    allowInterest: formValue(formData, "allowInterest"),
    allowLateFees: formValue(formData, "allowLateFees"),
    allowAdvancePayments: formValue(formData, "allowAdvancePayments"),
    termsSummary: formValue(formData, "termsSummary"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);
  const data = parsed.data;
  if (data.defaultInstallmentCount > data.maxInstallments) {
    return fail("Default installment count cannot exceed the maximum.");
  }

  await getDatabase().$transaction(async (tx) => {
    const settings = await tx.installmentSetting.upsert({
      where: { businessId: data.businessId },
      create: {
        businessId: data.businessId,
        enabled: data.enabled,
        currency: data.currency,
        defaultDepositMode: data.defaultDepositMode,
        defaultDepositValue: decimal(data.defaultDepositValue),
        defaultFrequency: data.defaultFrequency,
        defaultInstallmentCount: data.defaultInstallmentCount,
        defaultPossession: data.defaultPossession,
        gracePeriodDays: data.gracePeriodDays,
        maxInstallments: data.maxInstallments,
        allowInterest: data.allowInterest,
        allowLateFees: data.allowLateFees,
        allowAdvancePayments: data.allowAdvancePayments,
        termsSummary: data.termsSummary ?? null,
      },
      update: {
        enabled: data.enabled,
        currency: data.currency,
        defaultDepositMode: data.defaultDepositMode,
        defaultDepositValue: decimal(data.defaultDepositValue),
        defaultFrequency: data.defaultFrequency,
        defaultInstallmentCount: data.defaultInstallmentCount,
        defaultPossession: data.defaultPossession,
        gracePeriodDays: data.gracePeriodDays,
        maxInstallments: data.maxInstallments,
        allowInterest: data.allowInterest,
        allowLateFees: data.allowLateFees,
        allowAdvancePayments: data.allowAdvancePayments,
        termsSummary: data.termsSummary ?? null,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "INSTALLMENT_SETTINGS_SAVED",
      targetType: "InstallmentSetting",
      targetId: settings.id,
      metadata: { businessId: data.businessId, enabled: data.enabled },
    });
  });

  revalidatePath(sellerPath(data.businessId));
  return ok(data.enabled ? "Installment sales enabled for this business." : "Settings saved.");
}

/**
 * Creates a contract with an immutable snapshot. Prices and currency are computed
 * server-side; the seller cannot inject a total or an already-paid amount.
 */
export async function createInstallmentAgreementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = createInstallmentAgreementSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    buyerEmail: formValue(formData, "buyerEmail"),
    source: formValue(formData, "source"),
    orderId: formValue(formData, "orderId"),
    itemName: formValue(formData, "itemName"),
    productId: formValue(formData, "productId"),
    sku: formValue(formData, "sku"),
    quantity: formValue(formData, "quantity"),
    unitPrice: formValue(formData, "unitPrice"),
    depositMode: formValue(formData, "depositMode"),
    depositValue: formValue(formData, "depositValue"),
    frequency: formValue(formData, "frequency"),
    installmentCount: formValue(formData, "installmentCount"),
    possessionModel: formValue(formData, "possessionModel"),
    firstDueDate: formValue(formData, "firstDueDate"),
    notes: formValue(formData, "notes"),
    latePaymentPolicy: formValue(formData, "latePaymentPolicy"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);
  const data = parsed.data;

  const database = getDatabase();
  const [settings, business, buyer] = await Promise.all([
    database.installmentSetting.findUnique({ where: { businessId: data.businessId } }),
    database.business.findUnique({
      where: { id: data.businessId },
      select: {
        name: true,
        businessCode: true,
        vendors: { select: { id: true }, take: 1 },
      },
    }),
    database.user.findUnique({
      where: { email: data.buyerEmail.trim().toLowerCase() },
      select: { id: true, email: true },
    }),
  ]);
  if (!settings?.enabled) {
    return fail("Enable installment sales in this business's settings first.");
  }
  if (!business) return fail("Business not found.");
  if (!buyer) return fail("No platform account matches that buyer email.");
  if (data.installmentCount > settings.maxInstallments) {
    return fail(`This business allows at most ${settings.maxInstallments} installments.`);
  }

  if (data.source === "MARKETPLACE") {
    if (!data.orderId) return fail("Marketplace agreements must reference an order.");
    const [order, vendorOrder] = await Promise.all([
      database.order.findUnique({
        where: { id: data.orderId },
        select: { customerId: true },
      }),
      database.vendorOrder.findFirst({
        where: { orderId: data.orderId, vendor: { businessId: data.businessId } },
        select: { id: true },
      }),
    ]);
    if (!order || order.customerId !== buyer.id || !vendorOrder) {
      return fail("That order does not belong to this buyer and seller.");
    }
  }

  const vendorId = business.vendors[0]?.id ?? null;
  let serverUnitPrice = data.unitPrice;
  let serverItemName = data.itemName;
  let serverSku = data.sku;
  if (data.productId) {
    if (!vendorId) return fail("This business has no studio vendor for stock reservations.");
    const product = await database.product.findFirst({
      where: { id: data.productId, vendorId, status: "PUBLISHED" },
      select: { price: true, name: true, sku: true },
    });
    if (!product) return fail("That product is not on sale in this business's studio.");
    // Catalogue price is authoritative when a real product is selected.
    serverUnitPrice = Number(product.price.toString());
    serverItemName = product.name;
    serverSku = product.sku ?? data.sku;
  }

  const cashPrice = Math.round(data.quantity * serverUnitPrice * 100) / 100;
  let terms;
  try {
    terms = calculateInstallmentTerms({
      cashPrice,
      // Interest and late fees are recorded as policy only in this slice.
      interestAmount: 0,
      extraCharges: 0,
      depositMode: data.depositMode,
      depositValue: data.depositValue,
      frequency: data.frequency,
      installmentCount: data.installmentCount,
      firstDueDate: data.firstDueDate,
    });
  } catch (error) {
    if (error instanceof InstallmentTermsError) return fail(error.message);
    throw error;
  }

  const snapshot: Prisma.InputJsonObject = {
    seller: { businessId: data.businessId, name: business.name, code: business.businessCode },
    buyer: { userId: buyer.id, email: buyer.email },
    source: data.source,
    orderId: data.orderId ?? null,
    item: {
      name: serverItemName,
      sku: serverSku ?? null,
      quantity: data.quantity,
      unitPrice: serverUnitPrice,
      lineTotal: cashPrice,
      productId: data.productId ?? null,
    },
    currency: settings.currency,
    terms: {
      depositMode: data.depositMode,
      depositValue: data.depositValue,
      depositAmount: terms.depositAmount,
      frequency: data.frequency,
      installmentCount: data.installmentCount,
      installmentAmount: terms.installmentAmount,
      outstandingBalance: terms.outstandingBalance,
      totalPayable: terms.totalPayable,
      possessionModel: data.possessionModel,
      gracePeriodDays: settings.gracePeriodDays,
      interestPolicy: "No interest applied in this slice.",
      latePaymentPolicy: data.latePaymentPolicy ?? "Not specified.",
    },
    schedule: terms.schedule.map((entry: ScheduleEntry) => ({
      sequence: entry.sequence,
      dueDate: entry.dueDate.toISOString(),
      amount: entry.amount,
    })),
    generatedAt: new Date().toISOString(),
  };

  let agreementId: string;
  try {
    agreementId = await database.$transaction(async (tx) => {
      const now = new Date();
      const agreement = await tx.installmentAgreement.create({
        data: {
          agreementNumber: makeDocumentNumber("IA"),
          businessId: data.businessId,
          buyerUserId: buyer.id,
          source: data.source,
          orderId: data.orderId ?? null,
          currency: settings.currency,
          cashPrice: decimal(cashPrice),
          depositAmount: decimal(terms.depositAmount),
          totalPayable: decimal(terms.totalPayable),
          outstandingBalance: decimal(terms.outstandingBalance),
          depositMode: data.depositMode,
          frequency: data.frequency,
          installmentCount: data.installmentCount,
          installmentAmount: decimal(terms.installmentAmount),
          possessionModel: data.possessionModel,
          gracePeriodDays: settings.gracePeriodDays,
          latePaymentPolicy: data.latePaymentPolicy ?? null,
          notes: data.notes ?? null,
          status: "PENDING_CUSTOMER_ACCEPTANCE",
          termsSnapshot: snapshot,
          sellerAcceptedAt: now,
          sellerAcceptedById: access.actorId,
          createdById: access.actorId,
          items: {
            create: {
              productId: data.productId ?? null,
              productName: serverItemName,
              sku: serverSku ?? null,
              quantity: data.quantity,
              unitPrice: decimal(serverUnitPrice),
              lineTotal: decimal(cashPrice),
            },
          },
          schedule: {
            create: terms.schedule.map((entry) => ({
              sequence: entry.sequence,
              dueDate: entry.dueDate,
              amount: decimal(entry.amount),
              currency: settings.currency,
            })),
          },
          events: {
            create: {
              type: "CREATED",
              fromStatus: null,
              toStatus: "PENDING_CUSTOMER_ACCEPTANCE",
              actorId: access.actorId,
              metadata: { source: data.source },
            },
          },
        },
        select: { id: true },
      });
      if (data.productId && vendorId) {
        await holdInstallmentStock(tx, {
          vendorId,
          productId: data.productId,
          quantity: data.quantity,
          agreementId: agreement.id,
          actorId: access.actorId,
        });
      }
      await recordAuditEvent(tx, {
        actorId: access.actorId,
        action: "INSTALLMENT_AGREEMENT_CREATED",
        targetType: "InstallmentAgreement",
        targetId: agreement.id,
        metadata: {
          businessId: data.businessId,
          buyerUserId: buyer.id,
          source: data.source,
          totalPayable: terms.totalPayable,
          currency: settings.currency,
        },
      });
      return agreement.id;
    });
  } catch (error) {
    if (error instanceof InstallmentStockError) return fail(error.message);
    throw error;
  }

  revalidatePath(sellerPath(data.businessId));
  revalidatePath("/account/installments");
  return ok(
    `Agreement ${agreementId.slice(0, 8)} sent to the buyer for acceptance. No payment has been recorded.`,
  );
}

/** Buyer accepts from their own authenticated session; sellers cannot accept for them. */
export async function acceptInstallmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = acceptInstallmentSchema.safeParse({
    agreementId: formValue(formData, "agreementId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const actor = await requireActor("/account/installments");
  const database = getDatabase();
  const businessId = await database.$transaction(async (tx) => {
    const agreement = await tx.installmentAgreement.findFirst({
      where: {
        id: parsed.data.agreementId,
        buyerUserId: actor.id,
        status: "PENDING_CUSTOMER_ACCEPTANCE",
      },
      select: { id: true, businessId: true },
    });
    if (!agreement) return null;
    await tx.installmentAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "PENDING_DEPOSIT",
        buyerAcceptedAt: new Date(),
        buyerAcceptanceMethod: "ACCOUNT_SESSION",
      },
    });
    await tx.installmentAgreementEvent.create({
      data: {
        agreementId: agreement.id,
        type: "BUYER_ACCEPTED",
        fromStatus: "PENDING_CUSTOMER_ACCEPTANCE",
        toStatus: "PENDING_DEPOSIT",
        actorId: actor.id,
      },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "INSTALLMENT_AGREEMENT_ACCEPTED",
      targetType: "InstallmentAgreement",
      targetId: agreement.id,
      metadata: { businessId: agreement.businessId },
    });
    return agreement.businessId;
  });

  if (!businessId) return fail("That agreement is not awaiting your acceptance.");
  revalidatePath("/account/installments");
  revalidatePath(sellerPath(businessId));
  return ok("Terms accepted. Awaiting a verified deposit before activation.");
}

/** Cancellation before activation is allowed; financial reversal belongs to a later slice. */
export async function cancelInstallmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = cancelInstallmentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    agreementId: formValue(formData, "agreementId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);

  const result = await getDatabase().$transaction(async (tx) => {
    const agreement = await tx.installmentAgreement.findFirst({
      where: {
        id: parsed.data.agreementId,
        businessId: parsed.data.businessId,
        status: { in: ["PENDING_CUSTOMER_ACCEPTANCE", "PENDING_DEPOSIT"] },
      },
      select: { id: true },
    });
    if (!agreement) return null;
    await tx.installmentAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: parsed.data.reason,
      },
    });
    await releaseInstallmentStock(tx, agreement.id, access.actorId);
    await tx.installmentAgreementEvent.create({
      data: {
        agreementId: agreement.id,
        type: "CANCELLED",
        toStatus: "CANCELLED",
        actorId: access.actorId,
        metadata: { reason: parsed.data.reason },
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "INSTALLMENT_AGREEMENT_CANCELLED",
      targetType: "InstallmentAgreement",
      targetId: agreement.id,
      metadata: { businessId: parsed.data.businessId, reason: parsed.data.reason },
    });
    return agreement.id;
  });

  if (!result) return fail("Only an unactivated agreement can be cancelled in this slice.");
  revalidatePath(sellerPath(parsed.data.businessId));
  revalidatePath("/account/installments");
  return ok("Agreement cancelled. Its history is retained.");
}
