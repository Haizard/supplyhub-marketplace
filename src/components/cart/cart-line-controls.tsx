"use client";

import { useActionState } from "react";

import { QuantityStepper } from "@/components/storefront/quantity-stepper";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { removeCartLineAction, updateCartLineAction } from "@/features/cart/actions";
import { initialFormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

export interface CartLineControlsProps {
  cartItemId: string;
  quantity: number;
  maxQuantity: number;
  canUpdate: boolean;
}

export function CartLineControls({
  cartItemId,
  quantity,
  maxQuantity,
  canUpdate,
}: CartLineControlsProps) {
  const [state, formAction] = useActionState(updateCartLineAction, initialFormState);
  const t = useT();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="cartItemId" value={cartItemId} />
      <div className="flex flex-wrap items-center gap-2">
        {canUpdate ? (
          <>
            <QuantityStepper
              name="quantity"
              defaultValue={quantity}
              max={Math.max(quantity, maxQuantity)}
            />
            <Button type="submit" variant="secondary" size="sm">
              {t("common.update")}
            </Button>
          </>
        ) : null}
        <Button type="submit" formAction={removeCartLineAction} variant="ghost" size="sm">
          {t("common.remove")}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
