"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type {
  InvoiceStatus,
  PurchaseOrderStatus,
  QuotationStatus,
  RfqStatus,
} from "@/generated/prisma/enums";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { centsToDecimalString } from "@/features/catalog/money";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getSessionActor } from "@/server/auth/session";
import { requireAdmin } from "@/server/auth/guards";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/lib/logging/logger";

import { requireBusinessAccess } from "./access";
import { calculateOrderTotals, makeDocumentNumber } from "./pricing";
import {
  canTransitionInvoice,
  canTransitionPurchaseOrder,
  canTransitionQuotation,
  canTransitionRfq,
} from "./status";
import {
  invoicePaymentSchema,
  purchaseOrderSchema,
  quotationSchema,
  rfqSchema,
  statusUpdateSchema,
  wholesaleListingSchema,
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
function decimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(centsToDecimalString(cents));
}

function readItems(formData: FormData): unknown[] {
  const raw = formValue(formData, "items");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Wholesale listings (supplier side) ──────────────────────────────────────

export async function saveWholesaleListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireStudioAccess("wholesale.manage", "/vendor/wholesale");
  const parsed = wholesaleListingSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    vendorId: formValue(formData, "vendorId"),
    productId: formValue(formData, "productId"),
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    sku: formValue(formData, "sku"),
    currency: formValue(formData, "currency"),
    unitPrice: formValue(formData, "unitPrice"),
    minimumOrder: formValue(formData, "minimumOrder"),
    stockAvailable: formValue(formData, "stockAvailable"),
    leadTimeDays: formValue(formData, "leadTimeDays"),
    tierMin: formValue(formData, "tierMin"),
    tierMax: formValue(formData, "tierMax"),
    tierPrice: formValue(formData, "tierPrice"),
  });
  if (!parsed.success) return failFields(parsed.error);

  // The vendor id is always derived from the session, never from the client.
  if (parsed.data.vendorId !== access.vendorId)
    return fail("You can only manage your own listings.");

  const database = getDatabase();
  const data = parsed.data;
  const isEdit = Boolean(data.listingId);

  if (isEdit) {
    const existing = await database.wholesaleListing.findFirst({
      where: { id: data.listingId, vendorId: access.vendorId },
      select: { id: true },
    });
    if (!existing) return fail("That listing could not be found.");
  }

  const listingNumber = isEdit ? "" : makeDocumentNumber("WL");
  let listingId = data.listingId!;

  try {
    await database.$transaction(async (transaction) => {
      if (isEdit) {
        await transaction.wholesaleListing.update({
          where: { id: listingId },
          data: {
            title: data.title,
            description: data.description ?? "",
            productId: data.productId ?? null,
            sku: data.sku,
            currency: data.currency,
            unitPrice: decimal(data.unitPrice),
            minimumOrder: data.minimumOrder,
            stockAvailable: data.stockAvailable,
            leadTimeDays: data.leadTimeDays,
          },
        });
        await transaction.wholesalePriceTier.deleteMany({ where: { listingId } });
      } else {
        const created = await transaction.wholesaleListing.create({
          data: {
            listingNumber,
            vendorId: access.vendorId,
            businessId: access.businessId,
            productId: data.productId ?? null,
            title: data.title,
            description: data.description ?? "",
            sku: data.sku,
            currency: data.currency,
            unitPrice: decimal(data.unitPrice),
            minimumOrder: data.minimumOrder,
            stockAvailable: data.stockAvailable,
            leadTimeDays: data.leadTimeDays,
            status: "ACTIVE",
            publishedAt: new Date(),
          },
          select: { id: true },
        });
        listingId = created.id;
      }

      if (data.tierMin !== undefined && data.tierPrice !== undefined) {
        await transaction.wholesalePriceTier.create({
          data: {
            listingId,
            minQty: data.tierMin,
            maxQty: data.tierMax ?? null,
            unitPrice: decimal(data.tierPrice),
          },
        });
      }

      await recordAuditEvent(transaction, {
        actorId: access.actor.id,
        action: isEdit ? "WHOLESALE_LISTING_UPDATED" : "WHOLESALE_LISTING_CREATED",
        targetType: "wholesale_listing",
        targetId: listingId,
        metadata: { listingNumber: listingNumber || undefined },
      });
    });
  } catch (error) {
    logger.error("b2b.listing_save_failed", { actorId: access.actor.id, error });
    return fail("The wholesale listing could not be saved.");
  }

  revalidatePath("/vendor/wholesale");
  revalidatePath("/b2b/wholesale");
  return ok(isEdit ? "Wholesale listing updated." : "Wholesale listing published.");
}

export async function archiveWholesaleListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireStudioAccess("wholesale.manage", "/vendor/wholesale");
  const parsed = statusUpdateSchema.safeParse({
    id: formValue(formData, "listingId"),
    toStatus: "CLOSED",
  });
  if (!parsed.success) return failFields(parsed.error);

  const result = await getDatabase().$transaction(async (transaction) => {
    const listing = await transaction.wholesaleListing.findFirst({
      where: { id: parsed.data.id, vendorId: access.vendorId },
      select: { id: true, listingNumber: true, status: true },
    });
    if (!listing) return "not-found" as const;
    if (listing.status === "CLOSED") return "already-closed" as const;
    await transaction.wholesaleListing.update({
      where: { id: listing.id },
      data: { status: "CLOSED" },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actor.id,
      action: "WHOLESALE_LISTING_ARCHIVED",
      targetType: "wholesale_listing",
      targetId: listing.id,
      metadata: { listingNumber: listing.listingNumber },
    });
    return "ok" as const;
  });

  revalidatePath("/vendor/wholesale");
  revalidatePath("/b2b/wholesale");
  if (result === "not-found") return fail("That listing could not be found.");
  if (result === "already-closed") return fail("That listing is already closed.");
  return ok("Wholesale listing closed.");
}

// ── RFQs (buyer side) ───────────────────────────────────────────────────────

export async function createRfqAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessId = formValue(formData, "businessId");
  const access = await requireBusinessAccess(businessId, "b2b.rfq.create", "/b2b/rfq/new");

  const parsed = rfqSchema.safeParse({
    supplierVendorId: formValue(formData, "supplierVendorId"),
    currency: formValue(formData, "currency"),
    note: formValue(formData, "note"),
    targetDate: formValue(formData, "targetDate"),
    items: readItems(formData),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const supplier = await database.vendor.findFirst({
    where: { id: parsed.data.supplierVendorId, status: "APPROVED" },
    select: { id: true },
  });
  if (!supplier) return fail("That supplier could not be found.");

  const rfqNumber = makeDocumentNumber("RFQ");
  await database.$transaction(async (transaction) => {
    const rfq = await transaction.rfq.create({
      data: {
        rfqNumber,
        buyerBusinessId: access.businessId,
        supplierVendorId: supplier.id,
        submittedById: access.actorId,
        status: "SUBMITTED",
        currency: parsed.data.currency,
        note: parsed.data.note ?? null,
        targetDate: parsed.data.targetDate ?? null,
        submittedAt: new Date(),
        items: {
          create: parsed.data.items.map((item) => ({
            listingId: item.listingId ?? null,
            productName: item.productName,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unit: item.unit,
            targetPrice: item.targetPrice !== undefined ? decimal(item.targetPrice) : null,
            note: item.note ?? null,
          })),
        },
      },
      select: { id: true },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actorId,
      action: "RFQ_CREATED",
      targetType: "rfq",
      targetId: rfq.id,
      metadata: { rfqNumber, supplierVendorId: supplier.id },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actorId,
      action: "RFQ_SUBMITTED",
      targetType: "rfq",
      targetId: rfq.id,
      metadata: { rfqNumber },
    });
  });

  revalidatePath("/b2b/rfq");
  revalidatePath("/vendor/rfq");
  return ok(`RFQ ${rfqNumber} sent to the supplier.`);
}

export async function updateRfqStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = statusUpdateSchema.safeParse({
    id: formValue(formData, "rfqId"),
    toStatus: formValue(formData, "toStatus"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const toStatus = parsed.data.toStatus as RfqStatus;
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to update an RFQ.");

  const database = getDatabase();
  const rfq = await database.rfq.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      rfqNumber: true,
      status: true,
      buyerBusinessId: true,
      supplierVendorId: true,
      supplierVendor: { select: { ownerId: true, businessId: true } },
    },
  });
  if (!rfq) return fail("That RFQ could not be found.");

  const isBuyer = actor.role === "ADMIN" || rfq.buyerBusinessId === actor.business?.id;
  const vendor = await database.vendor.findFirst({
    where: { id: rfq.supplierVendorId, ownerId: actor.id },
    select: { id: true },
  });
  const isSupplier = Boolean(vendor) || actor.role === "ADMIN";
  if (!isBuyer && !isSupplier) return fail("You cannot update this RFQ.");

  // Buyers cancel; suppliers quote or reject. Admin can do either.
  if (!canTransitionRfq(rfq.status, toStatus))
    return fail("That RFQ cannot move to the requested state.");
  if (actor.role !== "ADMIN") {
    if (toStatus === "CANCELLED" && !isBuyer) return fail("Only the buyer can cancel an RFQ.");
    if (["QUOTED", "REJECTED"].includes(toStatus) && !isSupplier)
      return fail("Only the supplier can respond to an RFQ.");
  }

  await database.$transaction(async (transaction) => {
    await transaction.rfq.update({
      where: { id: rfq.id },
      data: {
        status: toStatus,
        ...(toStatus === "CANCELLED" ? { note: parsed.data.note ?? null } : {}),
      },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: toStatus === "CANCELLED" ? "RFQ_CANCELLED" : "RFQ_SUBMITTED",
      targetType: "rfq",
      targetId: rfq.id,
      metadata: { rfqNumber: rfq.rfqNumber, toStatus },
    });
  });

  revalidatePath("/b2b/rfq");
  revalidatePath("/vendor/rfq");
  return ok("RFQ updated.");
}

// ── Quotations (supplier side) ──────────────────────────────────────────────

export async function createQuotationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireStudioAccess("wholesale.manage", "/vendor/rfq");
  const parsed = quotationSchema.safeParse({
    rfqId: formValue(formData, "rfqId"),
    currency: formValue(formData, "currency"),
    note: formValue(formData, "note"),
    validUntil: formValue(formData, "validUntil"),
    items: readItems(formData),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const rfq = await database.rfq.findFirst({
    where: {
      id: parsed.data.rfqId,
      supplierVendorId: access.vendorId,
      status: { in: ["SUBMITTED", "QUOTED"] },
    },
    select: {
      id: true,
      rfqNumber: true,
      items: { select: { id: true, productName: true, sku: true } },
    },
  });
  if (!rfq) return fail("That RFQ is not open for quotations.");

  const validItemIds = new Set(rfq.items.map((item) => item.id));
  for (const item of parsed.data.items) {
    if (!validItemIds.has(item.rfqItemId))
      return fail("One of the priced items is not part of this RFQ.");
  }
  if (new Set(parsed.data.items.map((i) => i.rfqItemId)).size !== parsed.data.items.length) {
    return fail("Price each RFQ item only once.");
  }

  const lineTotals = parsed.data.items.map((item) => ({
    lineTotal: new Prisma.Decimal(centsToDecimalString(totalCents(item.unitPrice, item.quantity))),
  }));
  const totals = calculateOrderTotals({ items: lineTotals });
  const quotationNumber = makeDocumentNumber("QT");

  await database.$transaction(async (transaction) => {
    const quotation = await transaction.supplierQuotation.create({
      data: {
        quotationNumber,
        rfqId: rfq.id,
        supplierVendorId: access.vendorId,
        businessId: access.businessId,
        status: "SENT",
        currency: parsed.data.currency,
        subtotal: new Prisma.Decimal(totals.subtotal),
        note: parsed.data.note ?? null,
        validUntil: parsed.data.validUntil ?? null,
        sentAt: new Date(),
        items: {
          create: parsed.data.items.map((item, index) => {
            const source = rfq.items.find((r) => r.id === item.rfqItemId)!;
            return {
              rfqItemId: item.rfqItemId,
              productName: source.productName,
              sku: source.sku,
              quantity: item.quantity,
              unitPrice: decimal(item.unitPrice),
              lineTotal: lineTotals[index]!.lineTotal,
              currency: parsed.data.currency,
              note: item.note ?? null,
            };
          }),
        },
      },
      select: { id: true },
    });
    await transaction.rfq.update({
      where: { id: rfq.id },
      data: { status: "QUOTED" },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actor.id,
      action: "QUOTATION_CREATED",
      targetType: "supplier_quotation",
      targetId: quotation.id,
      metadata: { quotationNumber, rfqNumber: rfq.rfqNumber },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actor.id,
      action: "QUOTATION_SENT",
      targetType: "supplier_quotation",
      targetId: quotation.id,
      metadata: { quotationNumber },
    });
  });

  revalidatePath("/vendor/rfq");
  revalidatePath("/b2b/rfq");
  return ok(`Quotation ${quotationNumber} sent to the buyer.`);
}

function totalCents(unitPriceCents: number, quantity: number): number {
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) throw new Error("Invalid price.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Invalid quantity.");
  return unitPriceCents * quantity;
}

export async function updateQuotationStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = statusUpdateSchema.safeParse({
    id: formValue(formData, "quotationId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const toStatus = parsed.data.toStatus as QuotationStatus;
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to update a quotation.");

  const database = getDatabase();
  const quotation = await database.supplierQuotation.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      rfq: { select: { buyerBusinessId: true } },
    },
  });
  if (!quotation) return fail("That quotation could not be found.");
  if (!canTransitionQuotation(quotation.status, toStatus))
    return fail("That quotation cannot move to the requested state.");

  const isBuyer = actor.business?.id === quotation.rfq.buyerBusinessId;
  const isSupplier =
    actor.role === "ADMIN" ||
    Boolean(
      await database.vendor.findFirst({ where: { ownerId: actor.id }, select: { id: true } }),
    );
  if (["ACCEPTED", "REJECTED"].includes(toStatus) && !isBuyer && actor.role !== "ADMIN") {
    return fail("Only the buyer can accept or decline a quotation.");
  }
  if (toStatus === "SENT" && !isSupplier) return fail("Only the supplier can send a quotation.");

  await database.$transaction(async (transaction) => {
    await transaction.supplierQuotation.update({
      where: { id: quotation.id },
      data: { status: toStatus, ...(toStatus === "ACCEPTED" ? { acceptedAt: new Date() } : {}) },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action:
        toStatus === "ACCEPTED"
          ? "QUOTATION_ACCEPTED"
          : toStatus === "REJECTED"
            ? "QUOTATION_REJECTED"
            : "QUOTATION_SENT",
      targetType: "supplier_quotation",
      targetId: quotation.id,
      metadata: { quotationNumber: quotation.quotationNumber, toStatus },
    });
  });

  revalidatePath("/b2b/rfq");
  revalidatePath("/vendor/rfq");
  return ok("Quotation updated.");
}

// ── Purchase orders (buyer side) ────────────────────────────────────────────

export async function createPurchaseOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = formValue(formData, "businessId");
  const access = await requireBusinessAccess(
    businessId,
    "b2b.purchase_order.create",
    "/b2b/purchase-orders/new",
  );
  const parsed = purchaseOrderSchema.safeParse({
    businessId,
    supplierVendorId: formValue(formData, "supplierVendorId"),
    quotationId: formValue(formData, "quotationId"),
    currency: formValue(formData, "currency"),
    note: formValue(formData, "note"),
    tax: formValue(formData, "tax"),
    shipping: formValue(formData, "shipping"),
    items: readItems(formData),
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  if (parsed.data.quotationId) {
    const quote = await database.supplierQuotation.findFirst({
      where: {
        id: parsed.data.quotationId,
        status: "ACCEPTED",
        rfq: { buyerBusinessId: access.businessId },
      },
      select: { id: true },
    });
    if (!quote) return fail("That accepted quotation could not be found.");
  }

  const lineTotals = parsed.data.items.map((item) => ({
    lineTotal: new Prisma.Decimal(centsToDecimalString(totalCents(item.unitPrice, item.quantity))),
  }));
  const totals = calculateOrderTotals({
    items: lineTotals,
    taxCents: parsed.data.tax,
    shippingCents: parsed.data.shipping,
  });
  const poNumber = makeDocumentNumber("PO");

  await database.$transaction(async (transaction) => {
    const po = await transaction.businessPurchaseOrder.create({
      data: {
        poNumber,
        businessId: access.businessId,
        supplierVendorId: parsed.data.supplierVendorId,
        quotationId: parsed.data.quotationId ?? null,
        submittedById: access.actorId,
        status: "SENT",
        currency: parsed.data.currency,
        subtotal: new Prisma.Decimal(totals.subtotal),
        taxTotal: new Prisma.Decimal(totals.taxTotal),
        shippingTotal: new Prisma.Decimal(totals.shippingTotal),
        total: new Prisma.Decimal(totals.total),
        note: parsed.data.note ?? null,
        orderedAt: new Date(),
        items: {
          create: parsed.data.items.map((item, index) => ({
            listingId: item.listingId ?? null,
            productName: item.productName,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unitPrice: decimal(item.unitPrice),
            lineTotal: lineTotals[index]!.lineTotal,
            currency: parsed.data.currency,
          })),
        },
      },
      select: { id: true },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actorId,
      action: "PURCHASE_ORDER_CREATED",
      targetType: "business_purchase_order",
      targetId: po.id,
      metadata: { poNumber, total: totals.total },
    });
  });

  revalidatePath("/b2b/purchase-orders");
  revalidatePath("/vendor/purchase-orders");
  return ok(`Purchase order ${poNumber} sent to the supplier.`);
}

export async function updatePurchaseOrderStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = statusUpdateSchema.safeParse({
    id: formValue(formData, "poId"),
    toStatus: formValue(formData, "toStatus"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const toStatus = parsed.data.toStatus as PurchaseOrderStatus;
  const actor = await getSessionActor();
  if (!actor) return fail("Sign in to update a purchase order.");

  const database = getDatabase();
  const po = await database.businessPurchaseOrder.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, poNumber: true, status: true, businessId: true, supplierVendorId: true },
  });
  if (!po) return fail("That purchase order could not be found.");
  if (!canTransitionPurchaseOrder(po.status, toStatus))
    return fail("That purchase order cannot move to the requested state.");

  const isBuyer = actor.role === "ADMIN" || actor.business?.id === po.businessId;
  const isSupplier =
    actor.role === "ADMIN" ||
    Boolean(
      await database.vendor.findFirst({
        where: { id: po.supplierVendorId, ownerId: actor.id },
        select: { id: true },
      }),
    );
  const supplierSteps: PurchaseOrderStatus[] = ["CONFIRMED", "PROCESSING", "SHIPPED"];
  if (supplierSteps.includes(toStatus) && !isSupplier)
    return fail("Only the supplier can confirm or ship.");
  if (toStatus === "RECEIVED" && !isBuyer)
    return fail("Only the buyer can mark an order received.");
  if (toStatus === "CANCELLED" && !isBuyer && actor.role !== "ADMIN")
    return fail("Only the buyer can cancel.");

  await database.$transaction(async (transaction) => {
    await transaction.businessPurchaseOrder.update({
      where: { id: po.id },
      data: {
        status: toStatus,
        ...(toStatus === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
        ...(toStatus === "RECEIVED" ? { receivedAt: new Date() } : {}),
        ...(toStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      action: "PURCHASE_ORDER_STATUS_CHANGED",
      targetType: "business_purchase_order",
      targetId: po.id,
      metadata: { poNumber: po.poNumber, toStatus },
    });
  });

  revalidatePath("/b2b/purchase-orders");
  revalidatePath("/vendor/purchase-orders");
  return ok("Purchase order updated.");
}

// ── Invoices ────────────────────────────────────────────────────────────────

export async function issueInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireStudioAccess("wholesale.manage", "/vendor/invoices");
  const parsed = statusUpdateSchema.safeParse({
    id: formValue(formData, "poId"),
    toStatus: "ISSUED",
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const po = await database.businessPurchaseOrder.findFirst({
    where: {
      id: parsed.data.id,
      supplierVendorId: access.vendorId,
      status: { in: ["SHIPPED", "RECEIVED"] },
    },
    select: {
      id: true,
      poNumber: true,
      businessId: true,
      supplierVendorId: true,
      currency: true,
      subtotal: true,
      taxTotal: true,
      total: true,
      items: { select: { productName: true, quantity: true, unitPrice: true, lineTotal: true } },
    },
  });
  if (!po) return fail("That purchase order cannot be invoiced.");

  const existing = await database.businessInvoice.findFirst({
    where: { purchaseOrderId: po.id },
    select: { id: true },
  });
  if (existing) return fail("An invoice already exists for this order.");

  const invoiceNumber = makeDocumentNumber("INV");
  await database.$transaction(async (transaction) => {
    const invoice = await transaction.businessInvoice.create({
      data: {
        invoiceNumber,
        purchaseOrderId: po.id,
        businessId: po.businessId,
        supplierVendorId: access.vendorId,
        status: "ISSUED",
        currency: po.currency,
        subtotal: po.subtotal,
        taxTotal: po.taxTotal,
        total: po.total,
        issuedAt: new Date(),
        items: {
          create: po.items.map((item) => ({
            description: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            currency: po.currency,
          })),
        },
      },
      select: { id: true },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actor.id,
      action: "INVOICE_ISSUED",
      targetType: "business_invoice",
      targetId: invoice.id,
      metadata: { invoiceNumber, poNumber: po.poNumber },
    });
  });

  revalidatePath("/vendor/invoices");
  revalidatePath("/b2b/invoices");
  return ok(`Invoice ${invoiceNumber} issued.`);
}

export async function payInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = invoicePaymentSchema.safeParse({
    invoiceId: formValue(formData, "invoiceId"),
    amount: formValue(formData, "amount"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const businessId = formValue(formData, "businessId");
  const access = await requireBusinessAccess(businessId, "b2b.invoice.read", "/b2b/invoices");
  const database = getDatabase();

  const result = await database.$transaction(async (transaction) => {
    const invoice = await transaction.businessInvoice.findFirst({
      where: {
        id: parsed.data.invoiceId,
        businessId: access.businessId,
        status: { in: ["ISSUED", "OVERDUE"] },
      },
      select: { id: true, invoiceNumber: true, status: true, total: true, amountPaid: true },
    });
    if (!invoice) return "not-found" as const;
    // Invoice totals are Decimal currency amounts; payment input is integer cents.
    const totalCentsValue = Math.round(Number(invoice.total.toString()) * 100);
    const alreadyPaidCents = Math.round(Number(invoice.amountPaid.toString()) * 100);
    const newPaidCents = alreadyPaidCents + parsed.data.amount;
    if (newPaidCents > totalCentsValue) return "overpayment" as const;
    const settled = newPaidCents === totalCentsValue;

    await transaction.businessInvoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: decimal(newPaidCents),
        status: settled ? "PAID" : invoice.status,
        paidAt: settled ? new Date() : null,
      },
    });
    await recordAuditEvent(transaction, {
      actorId: access.actorId,
      action: "INVOICE_PAID",
      targetType: "business_invoice",
      targetId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, amount: parsed.data.amount, settled },
    });
    return "ok" as const;
  });

  revalidatePath("/b2b/invoices");
  revalidatePath("/vendor/invoices");
  if (result === "not-found") return fail("That invoice is not payable.");
  if (result === "overpayment") return fail("Payment exceeds the invoice balance.");
  return ok("Payment recorded.");
}

export async function adminUpdateInvoiceStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = statusUpdateSchema.safeParse({
    id: formValue(formData, "invoiceId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);
  const toStatus = parsed.data.toStatus as InvoiceStatus;

  const database = getDatabase();
  const invoice = await database.businessInvoice.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, invoiceNumber: true, status: true },
  });
  if (!invoice) return fail("That invoice could not be found.");
  if (!canTransitionInvoice(invoice.status, toStatus))
    return fail("That invoice cannot move to the requested state.");

  await database.$transaction(async (transaction) => {
    await transaction.businessInvoice.update({
      where: { id: invoice.id },
      data: {
        status: toStatus,
        ...(toStatus === "PAID" ? { paidAt: new Date() } : {}),
      },
    });
    await recordAuditEvent(transaction, {
      actorId: (await getSessionActor())!.id,
      action: "INVOICE_PAID",
      targetType: "business_invoice",
      targetId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, toStatus, admin: true },
    });
  });

  revalidatePath("/b2b/invoices");
  revalidatePath("/vendor/invoices");
  return ok("Invoice updated.");
}
