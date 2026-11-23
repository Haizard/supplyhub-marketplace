"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inviteMemberAction } from "@/features/logistics-companies/actions";
import type { CompanyRoleView } from "@/features/logistics-companies/queries";
import { initialFormState } from "@/features/identity/form-state";

export function MemberInviteForm({
  companyId,
  roles,
}: {
  companyId: string;
  roles: CompanyRoleView[];
}) {
  const [state, action, pending] = useActionState(inviteMemberAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      <Field label="Email address" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" required />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Roles</legend>
        {roles
          .filter((role) => !role.isSystem)
          .map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roleIds" value={role.id} className="size-4" />
              {role.name}
            </label>
          ))}
        {roles.filter((role) => !role.isSystem).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Create a custom role before inviting staff.
          </p>
        ) : null}
      </fieldset>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Inviting..." : "Invite member"}
      </Button>
    </form>
  );
}
