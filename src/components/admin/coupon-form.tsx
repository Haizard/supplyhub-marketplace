"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { createCouponAction } from "@/features/coupons/admin-actions";
import { initialFormState } from "@/features/identity/form-state";

export function CouponForm({ currency }: { currency: string }) {
  const [state, action] = useActionState(createCouponAction, initialFormState);
  const errors = state.fieldErrors;

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Code" htmlFor="coupon-code" error={errors?.code}>
          <Input
            id="coupon-code"
            name="code"
            required
            maxLength={32}
            autoComplete="off"
            className="uppercase"
            placeholder="WELCOME10"
          />
        </Field>

        <Field label="Kind" htmlFor="coupon-kind" error={errors?.kind}>
          <select
            id="coupon-kind"
            name="kind"
            defaultValue="PERCENT"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="PERCENT">Percentage off</option>
            <option value="FIXED">Fixed amount off</option>
          </select>
        </Field>
      </div>

      <Field label="Description" htmlFor="coupon-description" error={errors?.description}>
        <Input
          id="coupon-description"
          name="description"
          required
          maxLength={120}
          placeholder="Ten percent off the first order"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Value"
          htmlFor="coupon-value"
          hint="Percent (0–100) or amount."
          error={errors?.value}
        >
          <Input id="coupon-value" name="value" required inputMode="decimal" placeholder="10" />
        </Field>

        <Field label="Currency" htmlFor="coupon-currency" error={errors?.currency}>
          <Input
            id="coupon-currency"
            name="currency"
            required
            maxLength={3}
            defaultValue={currency}
            className="uppercase"
          />
        </Field>

        <Field
          label="Minimum subtotal"
          htmlFor="coupon-minimum"
          hint="Optional."
          error={errors?.minSubtotal}
        >
          <Input id="coupon-minimum" name="minSubtotal" inputMode="decimal" placeholder="0.00" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Maximum redemptions"
          htmlFor="coupon-maximum"
          hint="Optional. Leave empty for unlimited."
          error={errors?.maxRedemptions}
        >
          <Input id="coupon-maximum" name="maxRedemptions" inputMode="numeric" placeholder="100" />
        </Field>

        <Field label="Starts" htmlFor="coupon-starts" hint="Optional." error={errors?.startsAt}>
          <Input id="coupon-starts" name="startsAt" type="datetime-local" />
        </Field>

        <Field label="Ends" htmlFor="coupon-ends" hint="Optional." error={errors?.endsAt}>
          <Input id="coupon-ends" name="endsAt" type="datetime-local" />
        </Field>
      </div>

      <SubmitButton pendingLabel="Creating…">Create discount code</SubmitButton>
    </form>
  );
}
