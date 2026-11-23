"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createRoleAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";
import { LOGISTICS_PERMISSION_KEYS } from "@/features/logistics-companies/validation";

export function RoleForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createRoleAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      <Field label="Role name" htmlFor="name" error={errors.name}>
        <Input id="name" name="name" required />
      </Field>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Permissions</legend>
        {LOGISTICS_PERMISSION_KEYS.map((key) => (
          <label key={key} className="flex items-start gap-2 text-xs">
            <input type="checkbox" name="permissionKeys" value={key} className="mt-0.5 size-4" />
            <span className="font-mono">{key}</span>
          </label>
        ))}
      </fieldset>
      {errors.permissionKeys ? (
        <p className="text-sm text-danger">{errors.permissionKeys}</p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Creating..." : "Create role"}
      </Button>
    </form>
  );
}
