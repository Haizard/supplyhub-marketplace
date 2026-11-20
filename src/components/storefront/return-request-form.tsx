"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import { requestReturnAction } from "@/features/returns/actions";
import type { ReturnableItem } from "@/features/returns/queries";
import { useT } from "@/i18n/client";

const REASONS = ["DAMAGED", "NOT_AS_DESCRIBED", "WRONG_ITEM", "CHANGED_MIND", "OTHER"] as const;

export function ReturnRequestForm({
  vendorOrderId,
  items,
}: {
  vendorOrderId: string;
  items: ReturnableItem[];
}) {
  const t = useT();
  const [state, action] = useActionState(requestReturnAction, initialFormState);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="vendorOrderId" value={vendorOrderId} />
      <FormMessage state={state} />

      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.map((item) => (
          <li key={item.orderItemId} className="space-y-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("returns.ordered", { count: item.quantity })}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("returns.quantity")}
                htmlFor={`quantity-${item.orderItemId}`}
                hint={t("returns.quantityHint")}
              >
                <Input
                  id={`quantity-${item.orderItemId}`}
                  name={`quantity:${item.orderItemId}`}
                  type="number"
                  min={0}
                  max={item.returnableQuantity}
                  defaultValue={0}
                  inputMode="numeric"
                />
              </Field>

              <Field label={t("returns.reason")} htmlFor={`reason-${item.orderItemId}`}>
                <select
                  id={`reason-${item.orderItemId}`}
                  name={`reason:${item.orderItemId}`}
                  defaultValue="DAMAGED"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {t(`returns.reasons.${reason}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </li>
        ))}
      </ul>

      <Field label={t("returns.note")} htmlFor="return-note" hint={t("returns.noteHint")}>
        <Textarea id="return-note" name="note" rows={3} maxLength={500} />
      </Field>

      <SubmitButton pendingLabel={t("returns.submitting")} className="w-auto px-5">
        {t("returns.submit")}
      </SubmitButton>
    </form>
  );
}
