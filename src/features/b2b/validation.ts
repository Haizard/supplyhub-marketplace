import { z } from "zod";

import { MAX_PRICE_CENTS, parseMoneyToCents } from "@/features/catalog/money";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const moneyField = (label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return null;
      const cents = parseMoneyToCents(value.trim());
      return cents !== null && cents <= MAX_PRICE_CENTS ? cents : null;
    },
    z
      .number()
      .int()
      .nonnegative({ error: `Enter a valid ${label}.` }),
  );

const positiveInt = (label: string) =>
  z.coerce
    .number()
    .int()
    .positive({ error: `Enter a valid ${label}.` });

export const wholesaleListingSchema = z.object({
  listingId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  vendorId: uuid,
  productId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  title: z.string().trim().min(2, { error: "Enter a listing title." }).max(150),
  description: optionalText(2000),
  sku: z.string().trim().min(1).max(80),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  unitPrice: moneyField("unit price"),
  minimumOrder: positiveInt("minimum order"),
  stockAvailable: z.coerce.number().int().nonnegative(),
  leadTimeDays: z.coerce.number().int().nonnegative().max(365),
  tierMin: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  tierMax: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  tierPrice: z.preprocess((v) => (v === "" ? undefined : v), moneyField("tier price")),
});

export const rfqSchema = z.object({
  supplierVendorId: uuid,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: optionalText(1000),
  targetDate: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional()),
  items: z
    .array(
      z.object({
        listingId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
        productName: z.string().trim().min(1).max(150),
        sku: optionalText(80),
        quantity: positiveInt("quantity"),
        unit: z.string().trim().min(1).max(30).default("each"),
        targetPrice: z.preprocess((v) => (v === "" ? undefined : v), moneyField("target price")),
        note: optionalText(500),
      }),
    )
    .min(1, { error: "Add at least one item." })
    .max(50),
});

export const quotationSchema = z.object({
  rfqId: uuid,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: optionalText(1000),
  validUntil: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional()),
  items: z
    .array(
      z.object({
        rfqItemId: uuid,
        quantity: positiveInt("quantity"),
        unitPrice: moneyField("unit price"),
        note: optionalText(500),
      }),
    )
    .min(1, { error: "Price at least one item." })
    .max(50),
});

export const purchaseOrderSchema = z.object({
  businessId: uuid,
  supplierVendorId: uuid,
  quotationId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  note: optionalText(1000),
  tax: z.preprocess((v) => (v === "" ? 0 : v), moneyField("tax")),
  shipping: z.preprocess((v) => (v === "" ? 0 : v), moneyField("shipping")),
  items: z
    .array(
      z.object({
        listingId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
        productName: z.string().trim().min(1).max(150),
        sku: optionalText(80),
        quantity: positiveInt("quantity"),
        unitPrice: moneyField("unit price"),
      }),
    )
    .min(1, { error: "Add at least one item." })
    .max(50),
});

export const statusUpdateSchema = z.object({
  id: uuid,
  toStatus: z.string().trim().min(1).max(40),
  note: optionalText(500),
});

export const invoicePaymentSchema = z.object({
  invoiceId: uuid,
  amount: moneyField("payment amount"),
});
