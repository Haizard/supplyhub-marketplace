"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import { canTransitionRelationship } from "./status";
import { clientSchema, contactSchema, relationshipStatusSchema } from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

/** Creates or updates a client and this company's relationship to it. */
export async function saveClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = clientSchema.safeParse({
    clientId: formValue(formData, "clientId"),
    companyId: formValue(formData, "companyId"),
    name: formValue(formData, "name"),
    businessName: formValue(formData, "businessName"),
    phone: formValue(formData, "phone"),
    email: formValue(formData, "email"),
    address: formValue(formData, "address"),
    city: formValue(formData, "city"),
    latitude: formValue(formData, "latitude"),
    longitude: formValue(formData, "longitude"),
    accountCode: formValue(formData, "accountCode"),
    serviceNotes: formValue(formData, "serviceNotes"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if ((parsed.data.latitude === undefined) !== (parsed.data.longitude === undefined)) {
    return fail("Provide both latitude and longitude, or neither.");
  }

  const access = await requireLogisticsAccess(
    "logistics.client.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/clients`,
  );
  const database = getDatabase();
  const isEdit = Boolean(parsed.data.clientId);

  if (isEdit) {
    const relationship = await database.companyClientRelationship.findUnique({
      where: {
        companyId_clientId: { companyId: access.companyId, clientId: parsed.data.clientId! },
      },
      select: { id: true },
    });
    if (!relationship) return fail("This client is not linked to your company.");
  }

  let clientId = parsed.data.clientId ?? "";
  let clientNumber = "";

  try {
    await database.$transaction(async (tx) => {
      const values = {
        name: parsed.data.name,
        businessName: parsed.data.businessName ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        latitude:
          parsed.data.latitude !== undefined ? new Prisma.Decimal(parsed.data.latitude) : null,
        longitude:
          parsed.data.longitude !== undefined ? new Prisma.Decimal(parsed.data.longitude) : null,
      };

      if (isEdit) {
        await tx.logisticsClient.update({ where: { id: clientId }, data: values });
        await tx.companyClientRelationship.update({
          where: {
            companyId_clientId: { companyId: access.companyId, clientId },
          },
          data: {
            accountCode: parsed.data.accountCode ?? null,
            serviceNotes: parsed.data.serviceNotes ?? null,
          },
        });
      } else {
        clientNumber = makeDocumentNumber("LCL");
        const created = await tx.logisticsClient.create({
          data: { ...values, clientNumber, status: "PROSPECT", createdById: access.actorId },
          select: { id: true },
        });
        clientId = created.id;
        await tx.companyClientRelationship.create({
          data: {
            companyId: access.companyId,
            clientId,
            status: "PENDING",
            accountCode: parsed.data.accountCode ?? null,
            serviceNotes: parsed.data.serviceNotes ?? null,
          },
        });
      }

      await recordAuditEvent(tx, {
        actorId: access.actorId,
        action: isEdit ? "LOGISTICS_CLIENT_UPDATED" : "LOGISTICS_CLIENT_CREATED",
        targetType: "LogisticsClient",
        targetId: clientId,
        metadata: { companyId: access.companyId, clientNumber: clientNumber || undefined },
      });
      await appendOutboxEvent(tx, {
        eventType: isEdit ? "logistics.client.updated" : "logistics.client.created",
        aggregateType: "LogisticsClient",
        aggregateId: clientId,
        payload: { companyId: access.companyId, clientNumber: clientNumber || undefined },
      });
    });
  } catch {
    return fail("The client could not be saved.");
  }

  revalidatePath(`/logistics/${access.companyId}/clients`);
  revalidatePath(`/logistics/${access.companyId}/clients/${clientId}`);
  return ok(isEdit ? "Client updated." : "Client registered.");
}

export async function saveContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = contactSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    clientId: formValue(formData, "clientId"),
    contactId: formValue(formData, "contactId"),
    name: formValue(formData, "name"),
    role: formValue(formData, "role"),
    phone: formValue(formData, "phone"),
    email: formValue(formData, "email"),
    isPrimary: formValue(formData, "isPrimary") || "off",
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.client.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/clients`,
  );
  const database = getDatabase();
  const relationship = await database.companyClientRelationship.findUnique({
    where: {
      companyId_clientId: { companyId: access.companyId, clientId: parsed.data.clientId },
    },
    select: { id: true },
  });
  if (!relationship) return fail("This client is not linked to your company.");

  await database.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.clientContact.updateMany({
        where: { clientId: parsed.data.clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    const values = {
      name: parsed.data.name,
      role: parsed.data.role ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      isPrimary: parsed.data.isPrimary,
    };
    if (parsed.data.contactId) {
      const existing = await tx.clientContact.findFirst({
        where: { id: parsed.data.contactId, clientId: parsed.data.clientId },
        select: { id: true },
      });
      if (!existing) throw new Error("not-found");
      await tx.clientContact.update({ where: { id: existing.id }, data: values });
    } else {
      await tx.clientContact.create({ data: { clientId: parsed.data.clientId, ...values } });
    }
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_CLIENT_CONTACT_SAVED",
      targetType: "LogisticsClient",
      targetId: parsed.data.clientId,
      metadata: { companyId: access.companyId, name: parsed.data.name },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/clients/${parsed.data.clientId}`);
  return ok(parsed.data.contactId ? "Contact updated." : "Contact added.");
}

export async function updateRelationshipStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = relationshipStatusSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    clientId: formValue(formData, "clientId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.client.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/clients`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const relationship = await tx.companyClientRelationship.findUnique({
      where: {
        companyId_clientId: { companyId: access.companyId, clientId: parsed.data.clientId },
      },
      select: { id: true, status: true },
    });
    if (!relationship) return "not-found" as const;
    if (!canTransitionRelationship(relationship.status, parsed.data.toStatus))
      return "invalid" as const;

    await tx.companyClientRelationship.update({
      where: { id: relationship.id },
      data: {
        status: parsed.data.toStatus,
        verifiedById: parsed.data.toStatus === "ACTIVE" ? access.actorId : null,
        verifiedAt: parsed.data.toStatus === "ACTIVE" ? new Date() : null,
      },
    });
    if (parsed.data.toStatus === "ACTIVE") {
      await tx.logisticsClient.update({
        where: { id: parsed.data.clientId },
        data: { status: "ACTIVE", verifiedAt: new Date() },
      });
    }
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_CLIENT_RELATIONSHIP_CHANGED",
      targetType: "LogisticsClient",
      targetId: parsed.data.clientId,
      metadata: { companyId: access.companyId, status: parsed.data.toStatus },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.client.relationship_changed",
      aggregateType: "LogisticsClient",
      aggregateId: parsed.data.clientId,
      payload: { companyId: access.companyId, status: parsed.data.toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/clients`);
  revalidatePath(`/logistics/${access.companyId}/clients/${parsed.data.clientId}`);
  if (result === "not-found") return fail("This client is not linked to your company.");
  if (result === "invalid") return fail("That relationship change is not allowed.");
  return ok("Relationship updated.");
}
