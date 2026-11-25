"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { authorizeInstallmentSeller } from "./access";
import { reconcileInstallmentBusiness } from "./reconciliation-service";
import { openInstallmentDisputeSchema, resolveInstallmentDisputeSchema } from "./validation";

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

/** Sellers and buyers can open disputes, but only on their own agreement. */
export async function openInstallmentDisputeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = openInstallmentDisputeSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    agreementId: formValue(formData, "agreementId"),
    paymentId: formValue(formData, "paymentId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const isSeller = Boolean(parsed.data.businessId);
  let actorId: string;
  let openedByRole: "SELLER" | "BUYER";

  if (isSeller) {
    const access = await authorizeInstallmentSeller(parsed.data.businessId!);
    if ("error" in access) return fail(access.error);
    actorId = access.actor.id;
    openedByRole = "SELLER";
    const owns = await database.installmentAgreement.findFirst({
      where: { id: parsed.data.agreementId, businessId: parsed.data.businessId },
      select: { id: true },
    });
    if (!owns) return fail("Agreement not found for this business.");
  } else {
    const actor = await requireActor("/account/installments");
    actorId = actor.id;
    openedByRole = "BUYER";
    const owns = await database.installmentAgreement.findFirst({
      where: { id: parsed.data.agreementId, buyerUserId: actor.id },
      select: { id: true },
    });
    if (!owns) return fail("Agreement not found for your account.");
  }

  const disputeId = await database.$transaction(async (tx) => {
    const dispute = await tx.installmentDispute.create({
      data: {
        disputeNumber: makeDocumentNumber("ID"),
        agreementId: parsed.data.agreementId,
        paymentId: parsed.data.paymentId ?? null,
        openedById: actorId,
        openedByRole,
        reason: parsed.data.reason,
        status: "OPEN",
      },
      select: { id: true },
    });
    await tx.installmentAgreement.update({
      where: { id: parsed.data.agreementId },
      data: { status: "DISPUTED" },
    });
    await tx.installmentAgreementEvent.create({
      data: {
        agreementId: parsed.data.agreementId,
        type: "DISPUTE_OPENED",
        toStatus: "DISPUTED",
        actorId,
        metadata: { disputeId: dispute.id, openedByRole },
      },
    });
    await recordAuditEvent(tx, {
      actorId,
      action: "INSTALLMENT_DISPUTE_OPENED",
      targetType: "InstallmentDispute",
      targetId: dispute.id,
      metadata: { agreementId: parsed.data.agreementId, openedByRole },
    });
    return dispute.id;
  });

  revalidatePath("/account/installments");
  const agreement = await database.installmentAgreement.findUnique({
    where: { id: parsed.data.agreementId },
    select: { businessId: true },
  });
  if (agreement) revalidatePath(sellerPath(agreement.businessId));
  return ok(`Dispute ${disputeId.slice(0, 8)} opened. The agreement is now DISPUTED.`);
}

/** Seller closes a dispute. Resolution is recorded; money is never moved here. */
export async function resolveInstallmentDisputeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = resolveInstallmentDisputeSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    disputeId: formValue(formData, "disputeId"),
    decision: formValue(formData, "decision"),
    resolution: formValue(formData, "resolution"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await authorizeInstallmentSeller(parsed.data.businessId);
  if ("error" in access) return fail(access.error);

  const result = await getDatabase().$transaction(async (tx) => {
    const dispute = await tx.installmentDispute.findFirst({
      where: {
        id: parsed.data.disputeId,
        agreement: { businessId: parsed.data.businessId },
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
      select: { id: true, agreementId: true },
    });
    if (!dispute) return null;

    const status = parsed.data.decision === "RESOLVE" ? "RESOLVED" : "REJECTED";
    await tx.installmentDispute.update({
      where: { id: dispute.id },
      data: {
        status,
        resolution: parsed.data.resolution,
        resolvedById: access.actor.id,
        resolvedAt: new Date(),
      },
    });
    const agreement = await tx.installmentAgreement.findUnique({
      where: { id: dispute.agreementId },
      select: { status: true },
    });
    const restoredStatus = agreement?.status === "DISPUTED" ? "ACTIVE" : agreement?.status;
    await tx.installmentAgreement.update({
      where: { id: dispute.agreementId },
      data: { status: restoredStatus ?? "ACTIVE" },
    });
    await tx.installmentAgreementEvent.create({
      data: {
        agreementId: dispute.agreementId,
        type: "DISPUTE_RESOLVED",
        fromStatus: "DISPUTED",
        toStatus: restoredStatus ?? "ACTIVE",
        actorId: access.actor.id,
        metadata: { disputeId: dispute.id, status },
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actor.id,
      action: "INSTALLMENT_DISPUTE_RESOLVED",
      targetType: "InstallmentDispute",
      targetId: dispute.id,
      metadata: { status, agreementId: dispute.agreementId },
    });
    return dispute.id;
  });

  if (!result) return fail("That dispute is no longer open.");
  revalidatePath(sellerPath(parsed.data.businessId));
  revalidatePath("/account/installments");
  return ok("Dispute closed. Use payments or refunds for any financial adjustment.");
}

export async function reconcileInstallmentBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const businessId = formValue(formData, "businessId");
  if (!z.uuid().safeParse(businessId).success) return fail("Invalid business reference.");
  const access = await authorizeInstallmentSeller(businessId);
  if ("error" in access) return fail(access.error);

  const result = await reconcileInstallmentBusiness(businessId, access.actor.id);
  revalidatePath(sellerPath(businessId));
  return ok(
    `Run ${result.runNumber}: checked ${result.checkedCount} payment(s), ${result.findingCount} finding(s).`,
  );
}
