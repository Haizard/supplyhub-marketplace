"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor, requireAdmin } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import {
  acceptInstallmentFinancingSchema,
  decideInstallmentFinancingSchema,
  fundInstallmentFinancingSchema,
} from "./validation";
import { canAcceptFinancing, canDecideFinancing, canFundFinancing } from "./financing-rules";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

async function ensureFinancingEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase10.installmentFinancing"))) {
    return fail("Financing partner operations are not approved on this platform.");
  }
  return null;
}

/** Platform admin decision. This records an offer; it does not disburse funds. */
export async function decideInstallmentFinancingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureFinancingEnabled();
  if (disabled) return disabled;
  await requireAdmin();

  const parsed = decideInstallmentFinancingSchema.safeParse({
    applicationId: formValue(formData, "applicationId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note"),
    offeredAmount: formValue(formData, "offeredAmount"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if (parsed.data.decision === "APPROVE" && parsed.data.offeredAmount === undefined) {
    return fail("An approved offer needs an offered amount.");
  }

  const admin = await requireActor("/admin/installments/financing");
  const result = await getDatabase().$transaction(async (tx) => {
    const application = await tx.installmentFinancingApplication.findFirst({
      where: { id: parsed.data.applicationId },
      select: { id: true, agreementId: true, status: true },
    });
    if (!application || !canDecideFinancing(application.status)) return null;

    const approved = parsed.data.decision === "APPROVE";
    await tx.installmentFinancingApplication.update({
      where: { id: application.id },
      data: {
        status: approved ? "APPROVED" : "DECLINED",
        decisionNote: parsed.data.note,
        offeredAmount:
          approved && parsed.data.offeredAmount !== undefined
            ? new Prisma.Decimal(parsed.data.offeredAmount)
            : null,
        offeredAt: approved ? new Date() : null,
        decidedById: admin.id,
        decidedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "INSTALLMENT_FINANCING_DECIDED",
      targetType: "InstallmentFinancingApplication",
      targetId: application.id,
      metadata: {
        agreementId: application.agreementId,
        decision: parsed.data.decision,
      },
    });
    return application.agreementId;
  });
  if (!result) return fail("That application is no longer awaiting a decision.");
  revalidatePath("/admin/installments/financing");
  revalidatePath(`/account/installments/${result}`);
  return ok(
    parsed.data.decision === "APPROVE" ? "Offer recorded for the buyer." : "Application declined.",
  );
}

/** Buyer accepts a partner offer from their own session. */
export async function acceptInstallmentFinancingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureFinancingEnabled();
  if (disabled) return disabled;

  const parsed = acceptInstallmentFinancingSchema.safeParse({
    applicationId: formValue(formData, "applicationId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const actor = await requireActor("/account/installments");
  const result = await getDatabase().$transaction(async (tx) => {
    const application = await tx.installmentFinancingApplication.findFirst({
      where: {
        id: parsed.data.applicationId,
        agreement: { buyerUserId: actor.id },
      },
      select: { id: true, agreementId: true, status: true },
    });
    if (!application || !canAcceptFinancing(application.status)) return null;
    await tx.installmentFinancingApplication.update({
      where: { id: application.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "INSTALLMENT_FINANCING_ACCEPTED",
      targetType: "InstallmentFinancingApplication",
      targetId: application.id,
      metadata: { agreementId: application.agreementId },
    });
    return application.agreementId;
  });
  if (!result) return fail("No approved offer was found for your account.");
  revalidatePath(`/account/installments/${result}`);
  revalidatePath("/admin/installments/financing");
  return ok("Offer accepted. Funding is recorded separately by the platform administrator.");
}

/** Records a partner's funding reference. The platform does not move these funds. */
export async function recordInstallmentFundingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureFinancingEnabled();
  if (disabled) return disabled;
  await requireAdmin();

  const parsed = fundInstallmentFinancingSchema.safeParse({
    applicationId: formValue(formData, "applicationId"),
    providerReference: formValue(formData, "providerReference"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const admin = await requireActor("/admin/installments/financing");
  const result = await getDatabase().$transaction(async (tx) => {
    const application = await tx.installmentFinancingApplication.findFirst({
      where: { id: parsed.data.applicationId },
      select: { id: true, agreementId: true, status: true },
    });
    if (!application || !canFundFinancing(application.status)) return null;
    await tx.installmentFinancingApplication.update({
      where: { id: application.id },
      data: {
        status: "FUNDED",
        fundedAt: new Date(),
        providerReference: parsed.data.providerReference,
      },
    });
    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "INSTALLMENT_FINANCING_FUNDED",
      targetType: "InstallmentFinancingApplication",
      targetId: application.id,
      metadata: { agreementId: application.agreementId },
    });
    return application.agreementId;
  });
  if (!result) return fail("That accepted offer cannot be marked funded.");
  revalidatePath("/admin/installments/financing");
  revalidatePath(`/account/installments/${result}`);
  return ok("Partner funding reference recorded. No platform funds were moved.");
}
