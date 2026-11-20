"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { addToCartAction } from "@/features/cart/actions";
import type { ProductVariantOption } from "@/features/catalog/types";
import { formatMoney } from "@/features/catalog/money";
import { initialFormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

import { QuantityStepper } from "./quantity-stepper";

export interface AddToCartFormProps {
  productId: string;
  available: number;
  currency: string;
  variants: readonly ProductVariantOption[];
}

export function AddToCartForm({ productId, available, currency, variants }: AddToCartFormProps) {
  const [state, formAction] = useActionState(addToCartAction, initialFormState);
  const [variantId, setVariantId] = useState(
    () => variants.find((variant) => variant.stock > 0)?.id ?? variants[0]?.id ?? "",
  );
  const t = useT();

  const selected = variants.find((variant) => variant.id === variantId) ?? null;
  const availableQty = selected ? selected.stock : available;

  if (variants.length > 0 && availableQty <= 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted/60 p-5">
        <p className="text-sm font-medium">{t("product.optionSoldOut")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("product.optionSoldOutBody")}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {variants.length > 0 ? (
        <fieldset>
          <legend className="eyebrow mb-2 text-muted-foreground">{t("product.option")}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const soldOut = variant.stock <= 0;
              const active = variant.id === variantId;

              return (
                <label
                  key={variant.id}
                  className={
                    active
                      ? "cursor-pointer rounded-md border border-accent bg-surface px-3 py-2 text-sm shadow-[0_0_0_1px_var(--color-accent)]"
                      : "cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-border-strong"
                  }
                >
                  <input
                    type="radio"
                    name="variantId"
                    value={variant.id}
                    checked={active}
                    onChange={() => setVariantId(variant.id)}
                    className="sr-only"
                  />
                  <span className="block font-medium">{variant.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {soldOut ? t("common.soldOut") : formatMoney(variant.priceCents, currency)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="variantId" value="" />
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p id="quantity-label" className="eyebrow mb-2 text-muted-foreground">
            {t("common.quantity")}
          </p>
          <div role="group" aria-labelledby="quantity-label">
            <QuantityStepper name="quantity" max={Math.max(1, availableQty)} />
          </div>
        </div>
        <SubmitButton pendingLabel={t("product.adding")} size="lg" className="w-auto">
          {t("common.addToCart")}
        </SubmitButton>
      </div>

      <div>
        <FormMessage state={state} />
        {state.status === "success" ? (
          <p className="mt-2 text-sm">
            <Link
              href="/cart"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("product.reviewCart")}
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}
