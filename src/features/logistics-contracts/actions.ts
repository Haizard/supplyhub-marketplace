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

import { canTransitionContract, canTransitionInvoice } from "./status";
import {
  contractDeliverySchema,
  contractSchema,
  contractStatusSchema,
  invoiceSchema,
  invoiceStatusSchema,
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

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

export async function saveContractAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = contractSchema.safeParse({
    contractId: formValue(formData, "contractId"),
    companyId: formValue(formData, "companyId"),
    clientId: formValue(formData, "clientId"),
    type: formValue(formData, "type"),
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    currency: formValue(formData, "currency"),
    startsAt: formValue(formData, "startsAt"),
    endsAt: formValue(formData, "endsAt"),
    monthlyAllocation: formValue(formData, "monthlyAllocation"),
    coverageArea: formValue(formData, "coverageArea"),
    serviceHours: formValue(formData, "serviceHours"),
    paymentTerms: formValue(formData, "paymentTerms"),
    mode: formValue(formData, "mode"),
    perDelivery: formValue(formData, "perDelivery"),
    monthlyFee: formValue(formData, "monthlyFee"),
    perKmRate: formValue(formData, "perKmRate"),
    minimumFee: formValue(formData, "minimumFee"),
    includedUnits: formValue(formData, "includedUnits"),
    maxDeliveryHours: formValue(formData, "maxDeliveryHours"),
    minCompletionRateBps: formValue(formData, "minCompletionRateBps"),
    proofRequired: formValue(formData, "proofRequired") || "off",
    otpRequired: formValue(formData, "otpRequired") || "off",
    claimsWindowDays: formValue(formData, "claimsWindowDays"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.contract.manage",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/contracts`,
  );
  const database = getDatabase();
  const relationship = await database.companyClientRelationship.findUnique({
    where: {
      companyId_clientId: { companyId: access.companyId, clientId: parsed.data.clientId },
    },
    select: { id: true, status: true },
  });
  if (!relationship) return fail("That client is not linked to this company.");

  const isEdit = Boolean(parsed.data.contractId);
  if (isEdit) {
    const existing = await database.logisticsContract.findFirst({
      where: {
        id: parsed.data.contractId!,
        companyId: access.companyId,
        status: "DRAFT",
      },
      select: { id: true },
    });
    if (!existing) return fail("Only draft contracts can be edited.");
  }

  let contractId = parsed.data.contractId ?? "";
  let contractNumber = "";
  const previousVersionId = parsed.data.contractId ?? null;

  try {
    await database.$transaction(async (tx) => {
      const contractValues = {
        clientId: parsed.data.clientId,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        currency: parsed.data.currency,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt ?? null,
        monthlyAllocation: parsed.data.monthlyAllocation ?? null,
        coverageArea: parsed.data.coverageArea ?? null,
        serviceHours: parsed.data.serviceHours ?? null,
        paymentTerms: parsed.data.paymentTerms ?? null,
      };
      const pricingValues = {
        mode: parsed.data.mode,
        currency: parsed.data.currency,
        perDelivery:
          parsed.data.perDelivery !== undefined ? decimal(parsed.data.perDelivery) : null,
        monthlyFee: parsed.data.monthlyFee !== undefined ? decimal(parsed.data.monthlyFee) : null,
        perKmRate: parsed.data.perKmRate !== undefined ? decimal(parsed.data.perKmRate) : null,
        minimumFee: parsed.data.minimumFee !== undefined ? decimal(parsed.data.minimumFee) : null,
        includedUnits: parsed.data.includedUnits ?? null,
      };
      const slaValues = {
        maxDeliveryHours: parsed.data.maxDeliveryHours ?? null,
        minCompletionRateBps: parsed.data.minCompletionRateBps ?? null,
        proofRequired: parsed.data.proofRequired,
        otpRequired: parsed.data.otpRequired,
        claimsWindowDays: parsed.data.claimsWindowDays ?? null,
      };

      if (isEdit) {
        await tx.logisticsContract.update({ where: { id: contractId }, data: contractValues });
        await tx.contractPricing.update({ where: { contractId }, data: pricingValues });
        await tx.contractSla.update({ where: { contractId }, data: slaValues });
      } else {
        contractNumber = makeDocumentNumber("CNT");
        const created = await tx.logisticsContract.create({
          data: {
            ...contractValues,
            companyId: access.companyId,
            contractNumber,
            status: "DRAFT",
            version: 1,
            createdById: access.actorId,
          },
          select: { id: true },
        });
        contractId = created.id;
        await tx.contractPricing.create({ data: { contractId, ...pricingValues } });
        await tx.contractSla.create({ data: { contractId, ...slaValues } });
      }

      await recordAuditEvent(tx, {
        actorId: access.actorId,
        action: "LOGISTICS_CONTRACT_CREATED",
        targetType: "LogisticsContract",
        targetId: contractId,
        metadata: { companyId: access.companyId, contractNumber, version: isEdit ? 2 : 1 },
      });
      await appendOutboxEvent(tx, {
        eventType: isEdit ? "logistics.contract.revised" : "logistics.contract.created",
        aggregateType: "LogisticsContract",
        aggregateId: contractId,
        payload: { companyId: access.companyId, contractNumber },
      });
      void previousVersionId;
    });
  } catch {
    return fail("The contract could not be saved.");
  }

  revalidatePath(`/logistics/${access.companyId}/contracts`);
  revalidatePath(`/logistics/${access.companyId}/contracts/${contractId}`);
  return ok(isEdit ? "Contract revised." : "Contract created.");
}

export async function updateContractStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = contractStatusSchema.safeParse({
    contractId: formValue(formData, "contractId"),
    toStatus: formValue(formData, "toStatus"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.contract.manage",
    companyId,
    `/logistics/${companyId}/contracts`,
  );
  const { contractId, toStatus, note } = parsed.data;
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const contract = await tx.logisticsContract.findFirst({
      where: { id: contractId, companyId: access.companyId },
      select: { id: true, status: true, contractNumber: true },
    });
    if (!contract) return "not-found" as const;
    if (!canTransitionContract(contract.status, toStatus)) return "invalid" as const;

    // Dedicated fleet / geographic commitments reserve capacity: prevent overlapping
    // ACTIVE contracts for the same client in the same coverage area.
    if (toStatus === "ACTIVE") {
      const type = await tx.logisticsContract.findUnique({
        where: { id: contractId },
        select: { type: true, coverageArea: true },
      });
      if (type?.type === "DEDICATED_FLEET" || type?.type === "GEOGRAPHIC") {
        const conflicts = await tx.logisticsContract.count({
          where: {
            companyId: access.companyId,
            status: "ACTIVE",
            id: { not: contractId },
            type: type.type,
            ...(type.coverageArea ? { coverageArea: type.coverageArea } : {}),
          },
        });
        if (conflicts > 0) return "capacity" as const;
      }
    }

    await tx.logisticsContract.update({
      where: { id: contractId },
      data: {
        status: toStatus,
        acceptedAt: toStatus === "ACTIVE" ? new Date() : undefined,
        acceptedById: toStatus === "ACTIVE" ? access.actorId : undefined,
        suspendedAt: toStatus === "SUSPENDED" ? new Date() : null,
        terminatedAt: toStatus === "TERMINATED" ? new Date() : null,
        terminationReason: toStatus === "TERMINATED" ? (note ?? "") : null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_CONTRACT_STATUS_CHANGED",
      targetType: "LogisticsContract",
      targetId: contractId,
      metadata: {
        companyId: access.companyId,
        contractNumber: contract.contractNumber,
        status: toStatus,
      },
    });
    await appendOutboxEvent(tx, {
      eventType: `logistics.contract.${toStatus.toLowerCase()}`,
      aggregateType: "LogisticsContract",
      aggregateId: contractId,
      payload: { companyId: access.companyId, status: toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/contracts`);
  revalidatePath(`/logistics/${access.companyId}/contracts/${contractId}`);
  if (result === "not-found") return fail("That contract could not be found.");
  if (result === "invalid") return fail("That status change is not allowed.");
  if (result === "capacity") return fail("Reserved capacity already exists for this area.");
  return ok("Contract updated.");
}

export async function recordContractDeliveryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = contractDeliverySchema.safeParse({
    contractId: formValue(formData, "contractId"),
    reference: formValue(formData, "reference"),
    charge: formValue(formData, "charge"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.contract.manage",
    companyId,
    `/logistics/${companyId}/contracts`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const contract = await tx.logisticsContract.findFirst({
      where: { id: parsed.data.contractId, companyId: access.companyId, status: "ACTIVE" },
      select: { id: true, contractNumber: true, currency: true },
    });
    if (!contract) return "not-active" as const;

    const duplicate = await tx.contractDelivery.findFirst({
      where: { contractId: contract.id, reference: parsed.data.reference },
      select: { id: true },
    });
    if (duplicate) return "duplicate" as const;

    await tx.contractDelivery.create({
      data: {
        contractId: contract.id,
        reference: parsed.data.reference,
        charge: decimal(parsed.data.charge),
        currency: contract.currency,
        status: "COMPLETED",
        deliveredAt: new Date(),
        note: parsed.data.note ?? null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_CONTRACT_DELIVERY_RECORDED",
      targetType: "LogisticsContract",
      targetId: contract.id,
      metadata: {
        companyId: access.companyId,
        contractNumber: contract.contractNumber,
        reference: parsed.data.reference,
      },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/contracts/${parsed.data.contractId}`);
  if (result === "not-active") return fail("Only active contracts can record deliveries.");
  if (result === "duplicate") return fail("That delivery reference is already recorded.");
  return ok("Delivery recorded.");
}

export async function createInvoiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = invoiceSchema.safeParse({
    contractId: formValue(formData, "contractId"),
    periodStart: formValue(formData, "periodStart"),
    periodEnd: formValue(formData, "periodEnd"),
    dueAt: formValue(formData, "dueAt"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  if (parsed.data.periodEnd <= parsed.data.periodStart)
    return fail("Period end must follow the start.");

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.finance.read",
    companyId,
    `/logistics/${companyId}/invoices`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const contract = await tx.logisticsContract.findFirst({
      where: { id: parsed.data.contractId, companyId: access.companyId },
      select: { id: true, clientId: true, currency: true, contractNumber: true, status: true },
    });
    if (!contract) return "not-found" as const;

    const existing = await tx.logisticsInvoice.findFirst({
      where: {
        contractId: contract.id,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
      },
      select: { id: true },
    });
    if (existing) return "duplicate" as const;

    const deliveries = await tx.contractDelivery.findMany({
      where: {
        contractId: contract.id,
        status: "COMPLETED",
        createdAt: { gte: parsed.data.periodStart, lte: parsed.data.periodEnd },
      },
      select: { reference: true, charge: true },
    });
    const items = deliveries.map((delivery) => ({
      description: `Delivery ${delivery.reference}`,
      quantity: 1,
      unitPrice: delivery.charge,
      lineTotal: delivery.charge,
    }));
    const total = deliveries.reduce(
      (sum, delivery) => sum.plus(delivery.charge),
      new Prisma.Decimal(0),
    );

    const invoice = await tx.logisticsInvoice.create({
      data: {
        invoiceNumber: makeDocumentNumber("LIV"),
        contractId: contract.id,
        companyId: access.companyId,
        clientId: contract.clientId,
        status: "DRAFT",
        currency: contract.currency,
        subtotal: total,
        total,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        dueAt: parsed.data.dueAt ?? null,
        note: parsed.data.note ?? null,
        createdById: access.actorId,
        items: items.length > 0 ? { create: items } : undefined,
      },
      select: { id: true, invoiceNumber: true },
    });

    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_INVOICE_CREATED",
      targetType: "LogisticsInvoice",
      targetId: invoice.id,
      metadata: { companyId: access.companyId, invoiceNumber: invoice.invoiceNumber },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.invoice.created",
      aggregateType: "LogisticsInvoice",
      aggregateId: invoice.id,
      payload: { companyId: access.companyId, contractNumber: contract.contractNumber },
    });
    void contract.status;
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/invoices`);
  if (result === "not-found") return fail("That contract is not part of this company.");
  if (result === "duplicate") return fail("An invoice already exists for that period.");
  return ok("Invoice generated.");
}

export async function updateInvoiceStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = invoiceStatusSchema.safeParse({
    invoiceId: formValue(formData, "invoiceId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.finance.approve",
    companyId,
    `/logistics/${companyId}/invoices`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const invoice = await tx.logisticsInvoice.findFirst({
      where: { id: parsed.data.invoiceId, companyId: access.companyId },
      select: { id: true, status: true, invoiceNumber: true },
    });
    if (!invoice) return "not-found" as const;
    if (!canTransitionInvoice(invoice.status, parsed.data.toStatus)) return "invalid" as const;

    await tx.logisticsInvoice.update({
      where: { id: invoice.id },
      data: {
        status: parsed.data.toStatus,
        paidAt: parsed.data.toStatus === "PAID" ? new Date() : null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_INVOICE_UPDATED",
      targetType: "LogisticsInvoice",
      targetId: invoice.id,
      metadata: {
        companyId: access.companyId,
        invoiceNumber: invoice.invoiceNumber,
        status: parsed.data.toStatus,
      },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/invoices`);
  if (result === "not-found") return fail("That invoice could not be found.");
  if (result === "invalid") return fail("That invoice change is not allowed.");
  return ok("Invoice updated.");
}
