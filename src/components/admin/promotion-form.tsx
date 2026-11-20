"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import { createPromotionAction } from "@/features/promotions/admin-actions";

export function PromotionForm({
  currency,
  vendors,
  categories,
}: {
  currency: string;
  vendors: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(createPromotionAction, initialFormState);
  const [scope, setScope] = useState("MARKETPLACE");
  const errors = state.fieldErrors;

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <Field label="Name" htmlFor="promotion-name" error={errors?.name}>
        <Input
          id="promotion-name"
          name="name"
          required
          maxLength={80}
          placeholder="November making"
        />
      </Field>

      <Field label="Description" htmlFor="promotion-description" error={errors?.description}>
        <Input
          id="promotion-description"
          name="description"
          maxLength={160}
          placeholder="Ten percent off every studio this month"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Applies to" htmlFor="promotion-scope" error={errors?.scope}>
          <Select
            id="promotion-scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="MARKETPLACE">Every studio</option>
            <option value="VENDOR">One studio</option>
            <option value="CATEGORY">One department</option>
          </Select>
        </Field>

        {scope === "VENDOR" ? (
          <Field label="Studio" htmlFor="promotion-vendor" error={errors?.vendorId}>
            <Select id="promotion-vendor" name="vendorId" defaultValue="">
              <option value="" disabled>
                Choose a studio
              </option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {scope === "CATEGORY" ? (
          <Field label="Department" htmlFor="promotion-category" error={errors?.categoryId}>
            <Select id="promotion-category" name="categoryId" defaultValue="">
              <option value="" disabled>
                Choose a department
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Percentage off"
          htmlFor="promotion-percent"
          hint="1–90%. The platform funds it."
          error={errors?.percent}
        >
          <Input
            id="promotion-percent"
            name="percent"
            required
            inputMode="numeric"
            placeholder="10"
          />
        </Field>

        <Field label="Currency" htmlFor="promotion-currency" error={errors?.currency}>
          <Input
            id="promotion-currency"
            name="currency"
            required
            maxLength={3}
            defaultValue={currency}
            className="uppercase"
          />
        </Field>

        <Field label="Starts" htmlFor="promotion-starts" hint="Optional." error={errors?.startsAt}>
          <Input id="promotion-starts" name="startsAt" type="datetime-local" />
        </Field>

        <Field label="Ends" htmlFor="promotion-ends" hint="Optional." error={errors?.endsAt}>
          <Input id="promotion-ends" name="endsAt" type="datetime-local" />
        </Field>
      </div>

      <SubmitButton pendingLabel="Creating…">Create promotion</SubmitButton>
    </form>
  );
}
