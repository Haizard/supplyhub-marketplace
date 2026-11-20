"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { createWarehouseAction, setDefaultWarehouseFormAction } from "@/features/inventory/actions";
import { initialFormState } from "@/features/identity/form-state";

export function CreateWarehouseForm({
  title,
  submitLabel,
  pendingLabel,
}: {
  title: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, action] = useActionState(createWarehouseAction, initialFormState);
  const errors = state.fieldErrors;

  return (
    <form action={action} className="space-y-4">
      <h2 className="font-display text-lg font-medium tracking-[-0.02em]">{title}</h2>
      <FormMessage state={state} />

      <Field label="Name" htmlFor="warehouse-name" error={errors?.name}>
        <Input
          id="warehouse-name"
          name="name"
          required
          maxLength={60}
          placeholder="Kigoma branch"
          aria-invalid={errors?.name ? true : undefined}
          aria-describedby={errors?.name ? "warehouse-name-error" : undefined}
        />
      </Field>

      <Field label="Code" htmlFor="warehouse-code" hint="Short code, e.g. KGM" error={errors?.code}>
        <Input
          id="warehouse-code"
          name="code"
          required
          maxLength={12}
          spellCheck={false}
          placeholder="KGM"
          aria-invalid={errors?.code ? true : undefined}
          aria-describedby={errors?.code ? "warehouse-code-error" : undefined}
        />
      </Field>

      <Field label="Address" htmlFor="warehouse-address" hint="Optional" error={errors?.address}>
        <Input
          id="warehouse-address"
          name="address"
          maxLength={160}
          placeholder="Ujiji Road, Kigoma"
          aria-invalid={errors?.address ? true : undefined}
          aria-describedby={errors?.address ? "warehouse-address-error" : undefined}
        />
      </Field>

      <SubmitButton pendingLabel={pendingLabel} variant="secondary" size="sm" className="w-auto">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function SetDefaultWarehouseForm({
  warehouseId,
  label,
  pendingLabel,
}: {
  warehouseId: string;
  label: string;
  pendingLabel: string;
}) {
  return (
    <form action={setDefaultWarehouseFormAction}>
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <SubmitButton pendingLabel={pendingLabel} variant="ghost" size="sm" className="w-auto px-0">
        {label}
      </SubmitButton>
    </form>
  );
}
