"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBusinessAccess } from "@/features/b2b/access";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireAdmin } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { verificationDocumentSchema, verificationReviewSchema } from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

export async function submitVerificationDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = verificationDocumentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    documentType: formValue(formData, "documentType"),
    reference: formValue(formData, "reference"),
    storageKey: formValue(formData, "storageKey"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireBusinessAccess(
    parsed.data.businessId,
    "verification.manage",
    `/business/${parsed.data.businessId}/verification`,
  );

  const database = getDatabase();
  const created = await database.$transaction(async (tx) => {
    const document = await tx.businessVerificationDocument.create({
      data: {
        businessId: access.businessId,
        documentType: parsed.data.documentType,
        reference: parsed.data.reference,
        storageKey: parsed.data.storageKey,
        status: "PENDING",
      },
      select: { id: true },
    });

    await tx.business.update({
      where: { id: access.businessId },
      data: { verificationStatus: "pending" },
    });

    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "BUSINESS_VERIFICATION_SUBMITTED",
      targetType: "BusinessVerificationDocument",
      targetId: document.id,
      metadata: { businessId: access.businessId, documentType: parsed.data.documentType },
    });

    await appendOutboxEvent(tx, {
      eventType: "verification.document_submitted",
      aggregateType: "BusinessVerificationDocument",
      aggregateId: document.id,
      payload: { businessId: access.businessId, documentType: parsed.data.documentType },
    });

    return document;
  });

  revalidatePath(`/business/${access.businessId}/verification`);
  revalidatePath("/admin/verification");
  return ok(`Document ${created.id.slice(0, 8)} submitted for review.`);
}

export async function reviewVerificationDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = verificationReviewSchema.safeParse({
    documentId: formValue(formData, "documentId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note") || undefined,
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const document = await tx.businessVerificationDocument.findUnique({
      where: { id: parsed.data.documentId },
      select: { id: true, businessId: true, status: true },
    });
    if (!document) return { status: "not-found" as const, businessId: "" };
    if (document.status !== "PENDING") {
      return { status: "already-reviewed" as const, businessId: document.businessId };
    }

    await tx.businessVerificationDocument.update({
      where: { id: document.id },
      data: {
        status: parsed.data.decision,
        reviewNote: parsed.data.note ?? "",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    await tx.businessVerificationReview.create({
      data: {
        businessId: document.businessId,
        documentId: document.id,
        reviewerId: admin.id,
        decision: parsed.data.decision,
        note: parsed.data.note ?? "",
      },
    });

    // If any document is rejected the business is rejected; verified only when
    // every submitted document is approved.
    const remaining = await tx.businessVerificationDocument.count({
      where: { businessId: document.businessId, status: "PENDING" },
    });
    const rejected = await tx.businessVerificationDocument.count({
      where: { businessId: document.businessId, status: "REJECTED" },
    });
    const verificationStatus = rejected > 0 ? "rejected" : remaining === 0 ? "verified" : "pending";
    await tx.business.update({
      where: { id: document.businessId },
      data: { verificationStatus },
    });

    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: "BUSINESS_VERIFICATION_REVIEWED",
      targetType: "BusinessVerificationDocument",
      targetId: document.id,
      metadata: { businessId: document.businessId, decision: parsed.data.decision },
    });

    await appendOutboxEvent(tx, {
      eventType: "verification.document_reviewed",
      aggregateType: "BusinessVerificationDocument",
      aggregateId: document.id,
      payload: { businessId: document.businessId, decision: parsed.data.decision },
    });

    return { status: "ok" as const, businessId: document.businessId };
  });

  revalidatePath("/admin/verification");
  revalidatePath(`/business/${result.businessId}/verification`);
  if (result.status === "not-found") return fail("That document could not be found.");
  if (result.status === "already-reviewed") return fail("That document was already reviewed.");
  return ok("Review recorded.");
}
