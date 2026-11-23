"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { reviewVerificationDocumentAction } from "@/features/verification/actions";
import { initialFormState } from "@/features/identity/form-state";

export function VerificationReviewForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(
    reviewVerificationDocumentAction,
    initialFormState,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="documentId" value={documentId} />
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
        <p className="text-xs text-danger">{state.message}</p>
      ) : null}
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        {pending ? "Saving..." : "Submit review"}
      </Button>
    </form>
  );
}
