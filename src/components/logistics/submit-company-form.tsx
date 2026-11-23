"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { submitCompanyForVerificationAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";

export function SubmitCompanyForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(
    submitCompanyForVerificationAction,
    initialFormState,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Submitting..." : "Submit for verification"}
      </Button>
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}
