"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { reviewCompanyAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";

export function CompanyReviewForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(reviewCompanyAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Decision" htmlFor="decision">
        <select
          id="decision"
          name="decision"
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue="APPROVED"
        >
          <option value="APPROVED">Approve</option>
          <option value="REJECTED">Reject</option>
        </select>
      </Field>
      <Field label="Note" htmlFor="note">
        <Textarea id="note" name="note" maxLength={1000} />
      </Field>
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : "Submit decision"}
      </Button>
    </form>
  );
}
