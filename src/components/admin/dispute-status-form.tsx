"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { updateDisputeStatusAction } from "@/features/disputes/actions";
import { initialFormState } from "@/features/identity/form-state";
import type { DisputeStatus } from "@/generated/prisma/enums";

export function DisputeStatusForm({
  disputeId,
  status,
}: {
  disputeId: string;
  status: DisputeStatus;
}) {
  const [state, action, pending] = useActionState(updateDisputeStatusAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <Field label="Decision" htmlFor="toStatus" error={state.fieldErrors?.toStatus}>
        <select
          id="toStatus"
          name="toStatus"
          className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Choose a decision
          </option>
          {status === "OPEN" ? (
            <>
              <option value="UNDER_REVIEW">Start review</option>
              <option value="REJECTED">Reject</option>
            </>
          ) : null}
          {status === "UNDER_REVIEW" ? (
            <>
              <option value="RESOLVED">Resolve</option>
              <option value="REJECTED">Reject</option>
            </>
          ) : null}
        </select>
      </Field>
      <Field
        label="Resolution note"
        htmlFor="resolutionNote"
        error={state.fieldErrors?.resolutionNote}
      >
        <Textarea id="resolutionNote" name="resolutionNote" maxLength={2000} />
      </Field>
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : "Update dispute"}
      </Button>
    </form>
  );
}
