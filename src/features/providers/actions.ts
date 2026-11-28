"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireAdmin, requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

import { providerApplicationSchema, providerReviewSchema } from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

const APPLICANT_PATH = "/provider/verification";
const ADMIN_PATH = "/admin/providers";

function documentsFrom(input: {
  identityReference: string;
  licenceReference?: string;
  certificateReference?: string;
}): Prisma.InputJsonArray {
  return [
    { type: "IDENTITY", reference: input.identityReference },
    ...(input.licenceReference ? [{ type: "LICENCE", reference: input.licenceReference }] : []),
    ...(input.certificateReference
      ? [{ type: "CERTIFICATE", reference: input.certificateReference }]
      : []),
  ];
}

/**
 * Submits (or re-submits) one provider application.
 *
 * The entity is resolved from the session, never from the form: a farmer must
 * own the profile, a logistics company must have the applicant as an active
 * member, and a service studio must be owned by the applicant. One application
 * exists per entity; a rejected one can be corrected and sent again.
 */
export async function submitProviderApplicationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireActor(APPLICANT_PATH);
  const parsed = providerApplicationSchema.safeParse({
    entity: formValue(formData, "entity"),
    displayName: formValue(formData, "displayName"),
    contactPhone: formValue(formData, "contactPhone"),
    contactEmail: formValue(formData, "contactEmail"),
    district: formValue(formData, "district"),
    summary: formValue(formData, "summary"),
    identityReference: formValue(formData, "identityReference"),
    licenceReference: formValue(formData, "licenceReference"),
    certificateReference: formValue(formData, "certificateReference"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const data = parsed.data;
  const { providerType, entityId } = data.entity;

  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    let link: { farmerId: string } | { companyId: string } | { vendorId: string };

    if (providerType === "FARMER") {
      const farmer = await tx.agricultureFarmer.findFirst({
        where: { id: entityId, userId: actor.id },
        select: { id: true },
      });
      if (!farmer) return { status: "not-found" as const };
      link = { farmerId: farmer.id };
    } else if (providerType === "LOGISTICS_COMPANY") {
      const company = await tx.logisticsCompany.findFirst({
        where: { id: entityId, members: { some: { userId: actor.id, status: "ACTIVE" } } },
        select: { id: true },
      });
      if (!company) return { status: "not-found" as const };
      link = { companyId: company.id };
    } else {
      const vendor = await tx.vendor.findFirst({
        where: { id: entityId, ownerId: actor.id },
        select: { id: true },
      });
      if (!vendor) return { status: "not-found" as const };
      link = { vendorId: vendor.id };
    }

    const existing = await tx.providerApplication.findFirst({
      where: link,
      select: { id: true, status: true, applicationNumber: true },
    });
    if (existing?.status === "PENDING") return { status: "under-review" as const };
    if (existing?.status === "APPROVED") return { status: "approved" as const };

    const payload = {
      providerType,
      applicantId: actor.id,
      status: "PENDING" as const,
      displayName: data.displayName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      district: data.district ?? null,
      summary: data.summary,
      documents: documentsFrom(data),
      submittedAt: new Date(),
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
    };

    const application = existing
      ? await tx.providerApplication.update({
          where: { id: existing.id },
          data: payload,
          select: { id: true, applicationNumber: true, status: true },
        })
      : await tx.providerApplication.create({
          data: {
            applicationNumber: makeDocumentNumber("PA"),
            ...link,
            ...payload,
          },
          select: { id: true, applicationNumber: true, status: true },
        });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "PROVIDER_APPLICATION_SUBMITTED",
      targetType: "ProviderApplication",
      targetId: application.id,
      metadata: {
        applicationNumber: application.applicationNumber,
        providerType,
        resubmission: Boolean(existing),
      },
    });
    await appendOutboxEvent(tx, {
      eventType: "provider_application.submitted",
      aggregateType: "ProviderApplication",
      aggregateId: application.id,
      payload: { applicationNumber: application.applicationNumber, providerType },
    });

    return { status: "ok" as const, applicationNumber: application.applicationNumber };
  });

  revalidatePath(APPLICANT_PATH);
  revalidatePath(ADMIN_PATH);
  if (result.status === "not-found")
    return fail("That provider could not be found on your account.");
  if (result.status === "under-review") return fail("This provider is already awaiting review.");
  if (result.status === "approved") return fail("This provider is already approved.");
  return ok(`Application ${result.applicationNumber} submitted for review.`);
}

/**
 * Admin decision. Approving writes the verified status on the real entity
 * (farmer profile, logistics company or studio) in the same database
 * transaction as the application, so the badge and the approval cannot drift.
 */
export async function decideProviderApplicationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = providerReviewSchema.safeParse({
    applicationId: formValue(formData, "applicationId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const { applicationId, decision, note } = parsed.data;
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const application = await tx.providerApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicationNumber: true,
        providerType: true,
        farmerId: true,
        companyId: true,
        vendorId: true,
      },
    });
    if (!application) return { status: "not-found" as const };
    if (application.status !== "PENDING") return { status: "already-decided" as const };

    const reviewNote = note ?? null;
    const reviewedAt = new Date();

    if (application.providerType === "FARMER" && application.farmerId) {
      await tx.agricultureFarmer.update({
        where: { id: application.farmerId },
        data: {
          verificationStatus: decision === "APPROVED" ? "VERIFIED" : "REJECTED",
          verifiedById: admin.id,
          verifiedAt: reviewedAt,
          note: reviewNote,
        },
      });
    } else if (application.providerType === "LOGISTICS_COMPANY" && application.companyId) {
      await tx.logisticsCompany.update({
        where: { id: application.companyId },
        data: {
          status: decision === "APPROVED" ? "APPROVED" : "REJECTED",
          reviewedById: admin.id,
          reviewedAt,
          rejectionReason: decision === "REJECTED" ? reviewNote : null,
        },
      });
    } else if (application.providerType === "SERVICE_PROVIDER" && application.vendorId) {
      await tx.vendor.update({
        where: { id: application.vendorId },
        data: {
          status: decision === "APPROVED" ? "APPROVED" : "REJECTED",
          reviewedById: admin.id,
          reviewedAt,
          reviewNote,
        },
      });
    } else {
      return { status: "orphaned" as const };
    }

    await tx.providerApplication.update({
      where: { id: application.id },
      data: { status: decision, reviewedById: admin.id, reviewedAt, reviewNote },
    });

    await recordAuditEvent(tx, {
      actorId: admin.id,
      action:
        decision === "APPROVED" ? "PROVIDER_APPLICATION_APPROVED" : "PROVIDER_APPLICATION_REJECTED",
      targetType: "ProviderApplication",
      targetId: application.id,
      metadata: {
        applicationNumber: application.applicationNumber,
        providerType: application.providerType,
        decision,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: `provider_application.${decision.toLowerCase()}`,
      aggregateType: "ProviderApplication",
      aggregateId: application.id,
      payload: {
        applicationNumber: application.applicationNumber,
        providerType: application.providerType,
        decision,
      },
    });

    return { status: "ok" as const };
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath(APPLICANT_PATH);
  revalidatePath("/agriculture/marketplace");
  revalidatePath("/logistics");
  revalidatePath("/services");
  if (result.status === "not-found") return fail("That application could not be found.");
  if (result.status === "already-decided") return fail("That application was already decided.");
  if (result.status === "orphaned") return fail("That application has no provider attached.");
  return ok(decision === "APPROVED" ? "Provider approved." : "Application rejected.");
}
