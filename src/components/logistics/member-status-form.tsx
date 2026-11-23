"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { updateMemberStatusAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";

export function MemberStatusForm({
  companyId,
  memberId,
  status,
}: {
  companyId: string;
  memberId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updateMemberStatusAction, initialFormState);
  const target = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="toStatus" value={target} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving..." : target === "ACTIVE" ? "Activate" : "Suspend"}
      </Button>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}
