"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { authorizeInstallmentSeller } from "./access";
import { createContractDocument, signContractDocument } from "./contract-service";
import {
  createInstallmentDocumentSchema,
  decideInstallmentAmendmentSchema,
  proposeInstallmentAmendmentSchema,
  signInstallmentDocumentSchema,
  submitInstallmentFinancingSchema,
  voidInstallmentDocumentSchema,
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

export async function createInstallmentDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const parsed = createInstallmentDocumentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    agreementId: formValue(formData, "agreementId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeInstallmentSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);
  const database = getDatabase();
  const agreement = await database.installmentAgreement.findFirst({
    where: { id: parsed.data.agreementId, businessId: parsed.data.businessId },
    select: { termsSnapshot: true },
  });
  if (!agreement) return fail("Agreement not found for this business.");

  const document = await database.$transaction((tx) =>
    createContractDocument(tx, {
      agreementId: parsed.data.agreementId,
      actorId: access.actor.id,
      snapshot: agreement.termsSnapshot,
    }),
  );
  revalidatePath(`/business/${parsed.data.businessId}/installments/${parsed.data.agreementId}`);
  revalidatePath(`/account/installments/${parsed.data.agreementId}`);
  return ok(`Contract version ${document.version} created and awaiting both signatures.`);
}

export async function signInstallmentDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const parsed = signInstallmentDocumentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    documentId: formValue(formData, "documentId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const document = await database.installmentContractDocument.findUnique({
    where: { id: parsed.data.documentId },
    select: { agreementId: true, status: true },
  });
  if (!document || document.status === "VOID") return fail("Document not found or voided.");

  let signerUserId: string;
  let role: "BUYER" | "SELLER";
  if (parsed.data.businessId) {
    const access = await authorizeInstallmentSeller(parsed.data.businessId);
    if ("error" in access) return fail(access.error);
    const owns = await database.installmentAgreement.findFirst({
      where: { id: document.agreementId, businessId: parsed.data.businessId },
      select: { id: true },
    });
    if (!owns) return fail("Document does not belong to this business.");
    signerUserId = access.actor.id;
    role = "SELLER";
  } else {
    const actor = await requireActor("/account/installments");
    const owns = await database.installmentAgreement.findFirst({
      where: { id: document.agreementId, buyerUserId: actor.id },
      select: { id: true },
    });
    if (!owns) return fail("Document does not belong to your account.");
    signerUserId = actor.id;
    role = "BUYER";
  }

  const result = await database.$transaction((tx) =>
    signContractDocument(tx, { documentId: parsed.data.documentId, signerUserId, role }),
  );
  if (result === "ALREADY_SIGNED") return fail("You have already signed this version.");
  revalidatePath(`/account/installments/${document.agreementId}`);
  const agreement = await database.installmentAgreement.findUnique({
    where: { id: document.agreementId },
    select: { businessId: true },
  });
  if (agreement)
    revalidatePath(`/business/${agreement.businessId}/installments/${document.agreementId}`);
  return ok(
    result === "SIGNED"
      ? "Both parties signed. Contract version is complete."
      : "Signature recorded.",
  );
}

export async function voidInstallmentDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const parsed = voidInstallmentDocumentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    documentId: formValue(formData, "documentId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeInstallmentSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);
  const result = await getDatabase().$transaction(async (tx) => {
    const document = await tx.installmentContractDocument.findFirst({
      where: {
        id: parsed.data.documentId,
        status: { not: "VOID" },
        agreement: { businessId: parsed.data.businessId },
      },
      select: { id: true, agreementId: true },
    });
    if (!document) return null;
    await tx.installmentContractDocument.update({
      where: { id: document.id },
      data: { status: "VOID" },
    });
    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: "INSTALLMENT_CONTRACT_VOIDED",
      targetType: "InstallmentContractDocument",
      targetId: document.id,
      metadata: { agreementId: document.agreementId },
    });
    return document.agreementId;
  });
  if (!result) return fail("Document not found or already voided.");
  revalidatePath(`/business/${parsed.data.businessId}/installments/${result}`);
  return ok("Contract version voided. History is retained.");
}

export async function proposeInstallmentAmendmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const parsed = proposeInstallmentAmendmentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    agreementId: formValue(formData, "agreementId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeInstallmentSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);
  const database = getDatabase();
  const agreement = await database.installmentAgreement.findFirst({
    where: { id: parsed.data.agreementId, businessId: parsed.data.businessId },
    select: { id: true },
  });
  if (!agreement) return fail("Agreement not found for this business.");

  await database.$transaction(async (tx) => {
    const latest = await tx.installmentAmendment.findFirst({
      where: { agreementId: agreement.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const amendment = await tx.installmentAmendment.create({
      data: {
        amendmentNumber: makeDocumentNumber("IM"),
        agreementId: agreement.id,
        version: (latest?.version ?? 0) + 1,
        reason: parsed.data.reason,
        changes: { note: parsed.data.reason } satisfies Prisma.InputJsonObject,
        status: "PROPOSED",
        proposedById: access.actor.id,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: "INSTALLMENT_AMENDMENT_PROPOSED",
      targetType: "InstallmentAmendment",
      targetId: amendment.id,
      metadata: { agreementId: agreement.id },
    });
  });

  revalidatePath(`/account/installments/${agreement.id}`);
  return ok("Amendment proposed. It does not change the frozen financial snapshot.");
}

export async function decideInstallmentAmendmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  const parsed = decideInstallmentAmendmentSchema.safeParse({
    amendmentId: formValue(formData, "amendmentId"),
    decision: formValue(formData, "decision"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const actor = await requireActor("/account/installments");
  const result = await getDatabase().$transaction(async (tx) => {
    const amendment = await tx.installmentAmendment.findFirst({
      where: {
        id: parsed.data.amendmentId,
        status: "PROPOSED",
        agreement: { buyerUserId: actor.id },
      },
      select: { id: true, agreementId: true },
    });
    if (!amendment) return null;
    await tx.installmentAmendment.update({
      where: { id: amendment.id },
      data: {
        status: parsed.data.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED",
        decidedById: actor.id,
        decidedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "INSTALLMENT_AMENDMENT_DECIDED",
      targetType: "InstallmentAmendment",
      targetId: amendment.id,
      metadata: { decision: parsed.data.decision, agreementId: amendment.agreementId },
    });
    return amendment.agreementId;
  });
  if (!result) return fail("Amendment not found or already decided.");
  revalidatePath(`/account/installments/${result}`);
  return ok("Decision recorded. Financial terms remain in the original snapshot.");
}

/** Prepared interface only: records an application, makes no partner call or payment. */
export async function submitInstallmentFinancingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;
  if (!(await isFeatureEnabled("phase10.installmentFinancing"))) {
    return fail("Financing partner submissions are not approved on this platform.");
  }

  const parsed = submitInstallmentFinancingSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    agreementId: formValue(formData, "agreementId"),
    partnerCode: formValue(formData, "partnerCode"),
    requestedAmount: formValue(formData, "requestedAmount"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeInstallmentSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);
  const database = getDatabase();
  const agreement = await database.installmentAgreement.findFirst({
    where: { id: parsed.data.agreementId, businessId: parsed.data.businessId },
    select: { currency: true },
  });
  if (!agreement) return fail("Agreement not found for this business.");

  await database.$transaction(async (tx) => {
    const application = await tx.installmentFinancingApplication.create({
      data: {
        applicationNumber: makeDocumentNumber("IF"),
        agreementId: parsed.data.agreementId,
        partnerCode: parsed.data.partnerCode,
        requestedAmount: new Prisma.Decimal(parsed.data.requestedAmount),
        currency: agreement.currency,
        status: "SUBMITTED",
        submittedById: access.actor.id,
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: "INSTALLMENT_FINANCING_SUBMITTED",
      targetType: "InstallmentFinancingApplication",
      targetId: application.id,
      metadata: { agreementId: parsed.data.agreementId, partnerCode: parsed.data.partnerCode },
    });
  });

  revalidatePath(sellerPath(parsed.data.businessId));
  return ok("Application recorded for review. No funds are moved by this interface.");
}
