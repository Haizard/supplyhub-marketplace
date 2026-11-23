"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { toggleBranchStatusAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";

export function BranchStatusForm({
  companyId,
  branchId,
  isActive,
}: {
  companyId: string;
  branchId: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(toggleBranchStatusAction, initialFormState);

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branchId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}
