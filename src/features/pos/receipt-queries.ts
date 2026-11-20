import "server-only";

import { decimalToCents } from "@/features/catalog/money";
import { getDatabase } from "@/server/db/client";

export interface PosReceiptLine {
  id: string;
  name: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface PosReceiptPayment {
  id: string;
  method: string;
  amountCents: number;
  reference: string | null;
}

export interface PosReceipt {
  saleNumber: string;
  currency: string;
  soldAt: Date;
  cashierName: string | null;
  registerName: string;
  business: {
    name: string;
    street: string | null;
    city: string | null;
    phone: string | null;
  };
  items: PosReceiptLine[];
  payments: PosReceiptPayment[];
  subtotalCents: number;
  totalCents: number;
}

/**
 * One counter sale for its receipt, scoped to the vendor the studio context resolved.
 * The sale number is unique per vendor, so the client never supplies the vendor.
 */
export async function getPosSaleReceipt(
  vendorId: string,
  saleNumber: string,
): Promise<PosReceipt | null> {
  const sale = await getDatabase().sale.findFirst({
    where: { vendorId, saleNumber },
    select: {
      saleNumber: true,
      currency: true,
      soldAt: true,
      subtotal: true,
      total: true,
      soldBy: { select: { name: true } },
      session: { select: { register: { select: { name: true } } } },
      vendor: {
        select: { name: true, street: true, city: true, contactPhone: true },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          variantName: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, method: true, amount: true, reference: true },
      },
    },
  });

  if (!sale) return null;

  return {
    saleNumber: sale.saleNumber,
    currency: sale.currency,
    soldAt: sale.soldAt,
    cashierName: sale.soldBy?.name ?? null,
    registerName: sale.session.register.name,
    business: {
      name: sale.vendor.name,
      street: sale.vendor.street,
      city: sale.vendor.city,
      phone: sale.vendor.contactPhone,
    },
    items: sale.items.map((item) => ({
      id: item.id,
      name: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      quantity: item.quantity,
      unitPriceCents: decimalToCents(item.unitPrice),
      lineTotalCents: decimalToCents(item.lineTotal),
    })),
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amountCents: decimalToCents(payment.amount),
      reference: payment.reference,
    })),
    subtotalCents: decimalToCents(sale.subtotal),
    totalCents: decimalToCents(sale.total),
  };
}
