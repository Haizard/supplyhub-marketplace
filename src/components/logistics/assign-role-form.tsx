"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { assignRoleAction } from "@/features/logistics-companies/actions";
import type { CompanyRoleView } from "@/features/logistics-companies/queries";
import { initialFormState } from "@/features/identity/form-state";

export function AssignRoleForm({
  companyId,
  memberId,
  roles,
}: {
  companyId: string;
  memberId: string;
  roles: CompanyRoleView[];
}) {
  const [state, action, pending] = useActionState(assignRoleAction, initialFormState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="memberId" value={memberId} />
      <select
        name="roleId"
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        defaultValue=""
        required
      >
        <option value="" disabled>
          Add role
        </option>
        {roles
          .filter((role) => !role.isSystem)
          .map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
      </select>
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Assign
      </Button>
      {state.status === "error" && state.message ? (
        <span className="text-xs text-danger">{state.message}</span>
      ) : null}
    </form>
  );
}
