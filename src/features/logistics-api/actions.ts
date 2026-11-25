"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { hashApiSecret } from "@/server/logistics/api-auth";
import { getDatabase } from "@/server/db/client";

import { createApiKey, encryptWebhookSecret, generateWebhookSecret } from "./service";
import {
  apiKeySchema,
  endpointStatusSchema,
  externalStoreSchema,
  revokeKeySchema,
  webhookEndpointSchema,
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

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

export async function createKeyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = apiKeySchema.safeParse({
    companyId: formValue(formData, "companyId"),
    name: formValue(formData, "name"),
    scopes: formData.getAll("scopes").map(String),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/integrations`,
  );
  const created = await createApiKey(
    access.companyId,
    access.actorId,
    parsed.data.name,
    parsed.data.scopes,
    hashApiSecret,
  );

  revalidatePath(`/logistics/${access.companyId}/integrations`);
  return ok(`Copy this key now — it will not be shown again: ${created.secret}`);
}

export async function revokeKeyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = revokeKeySchema.safeParse({ keyId: formValue(formData, "keyId") });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    companyId,
    `/logistics/${companyId}/integrations`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const key = await tx.logisticsApiKey.findFirst({
      where: { id: parsed.data.keyId, companyId: access.companyId, status: "ACTIVE" },
      select: { id: true, keyId: true },
    });
    if (!key) return "not-found" as const;
    await tx.logisticsApiKey.update({
      where: { id: key.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_API_KEY_REVOKED",
      targetType: "LogisticsApiKey",
      targetId: key.id,
      metadata: { companyId: access.companyId, keyId: key.keyId },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/integrations`);
  if (result === "not-found") return fail("That active key could not be found.");
  return ok("API key revoked.");
}

export async function saveWebhookEndpointAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = webhookEndpointSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    url: formValue(formData, "url"),
    events: formData.getAll("events").map(String),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/integrations`,
  );
  const secret = generateWebhookSecret();
  const database = getDatabase();
  await database.$transaction(async (tx) => {
    const endpoint = await tx.logisticsWebhookEndpoint.create({
      data: {
        companyId: access.companyId,
        url: parsed.data.url,
        events: parsed.data.events,
        secret: encryptWebhookSecret(secret),
        status: "ACTIVE",
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_WEBHOOK_ENDPOINT_SAVED",
      targetType: "LogisticsWebhookEndpoint",
      targetId: endpoint.id,
      metadata: { companyId: access.companyId, url: parsed.data.url },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/integrations`);
  return ok(`Endpoint registered. Signing secret (shown once): ${secret}`);
}

export async function setEndpointStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = endpointStatusSchema.safeParse({
    endpointId: formValue(formData, "endpointId"),
    status: formValue(formData, "status"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    companyId,
    `/logistics/${companyId}/integrations`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const endpoint = await tx.logisticsWebhookEndpoint.findFirst({
      where: { id: parsed.data.endpointId, companyId: access.companyId },
      select: { id: true },
    });
    if (!endpoint) return "not-found" as const;
    await tx.logisticsWebhookEndpoint.update({
      where: { id: endpoint.id },
      data: { status: parsed.data.status },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/integrations`);
  if (result === "not-found") return fail("That endpoint could not be found.");
  return ok("Endpoint status updated.");
}

export async function saveExternalStoreAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = externalStoreSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    platform: formValue(formData, "platform"),
    externalStoreId: formValue(formData, "externalStoreId"),
    name: formValue(formData, "name"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.referral.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/integrations`,
  );
  const secret = generateWebhookSecret();
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const existing = await tx.logisticsExternalStore.findUnique({
      where: {
        companyId_platform_externalStoreId: {
          companyId: access.companyId,
          platform: parsed.data.platform,
          externalStoreId: parsed.data.externalStoreId,
        },
      },
      select: { id: true },
    });
    if (existing) return "duplicate" as const;

    const store = await tx.logisticsExternalStore.create({
      data: {
        companyId: access.companyId,
        platform: parsed.data.platform,
        externalStoreId: parsed.data.externalStoreId,
        name: parsed.data.name,
        webhookSecret: encryptWebhookSecret(secret),
        status: "ACTIVE",
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_EXTERNAL_STORE_SAVED",
      targetType: "LogisticsExternalStore",
      targetId: store.id,
      metadata: { companyId: access.companyId, platform: parsed.data.platform },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/integrations`);
  if (result === "duplicate") return fail("That external store is already registered.");
  return ok(`Store connected. Its webhook secret (shown once): ${secret}`);
}
