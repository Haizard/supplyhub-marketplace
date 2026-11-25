"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createInstallmentAgreementAction } from "@/features/installments/actions";
import { formValue, type FormState } from "@/features/identity/form-state";
import { requireStudioAccess } from "@/server/business/studio-access";
import { getDatabase } from "@/server/db/client";

const posInstallmentSchema = z.object({
  businessId: z.uuid(),
  productId: z.uuid(),
  buyerEmail: z.email(),
  quantity: z.coerce.number().int().min(1).max(99),
  depositMode: z.enum(["FIXED", "PERCENTAGE"]),
  depositValue: z.coerce.number().positive().max(1_000_000),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  installmentCount: z.coerce.number().int().min(1).max(60),
  possessionModel: z.enum(["IMMEDIATE", "AFTER_FULL_PAYMENT"]),
  firstDueDate: z.coerce.date(),
});

/**
 * POS cashier path: creates an installment agreement instead of a completed POS
 * sale. Stock is held by the agreement, so the same units are never sold twice.
 */
export async function createPosInstallmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireStudioAccess("pos.sale.create", "/vendor/pos");
  if (!access.businessId) {
    return { status: "error", message: "This studio is not linked to a business." };
  }

  const parsed = posInstallmentSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    productId: formValue(formData, "productId"),
    buyerEmail: formValue(formData, "buyerEmail"),
    quantity: formValue(formData, "quantity"),
    depositMode: formValue(formData, "depositMode"),
    depositValue: formValue(formData, "depositValue"),
    frequency: formValue(formData, "frequency"),
    installmentCount: formValue(formData, "installmentCount"),
    possessionModel: formValue(formData, "possessionModel"),
    firstDueDate: formValue(formData, "firstDueDate"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the installment terms and try again." };
  }
  if (parsed.data.businessId !== access.businessId) {
    return { status: "error", message: "Business mismatch." };
  }

  const product = await getDatabase().product.findFirst({
    where: { id: parsed.data.productId, vendorId: access.vendorId, status: "PUBLISHED" },
    select: { id: true, name: true },
  });
  if (!product) return { status: "error", message: "That product is not on sale." };

  const agreementForm = new FormData();
  agreementForm.set("businessId", parsed.data.businessId);
  agreementForm.set("buyerEmail", parsed.data.buyerEmail);
  agreementForm.set("source", "OFFLINE");
  agreementForm.set("itemName", product.name);
  agreementForm.set("productId", product.id);
  agreementForm.set("quantity", String(parsed.data.quantity));
  agreementForm.set("unitPrice", "0"); // Server overrides with the catalogue price.
  agreementForm.set("depositMode", parsed.data.depositMode);
  agreementForm.set("depositValue", String(parsed.data.depositValue));
  agreementForm.set("frequency", parsed.data.frequency);
  agreementForm.set("installmentCount", String(parsed.data.installmentCount));
  agreementForm.set("possessionModel", parsed.data.possessionModel);
  agreementForm.set("firstDueDate", parsed.data.firstDueDate.toISOString().slice(0, 10));

  const result = await createInstallmentAgreementAction({ status: "idle" }, agreementForm);
  revalidatePath("/vendor/pos");
  return result;
}
