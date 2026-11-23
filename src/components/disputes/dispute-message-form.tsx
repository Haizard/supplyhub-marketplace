"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { addDisputeMessageAction } from "@/features/disputes/actions";
import { initialFormState } from "@/features/identity/form-state";

export function DisputeMessageForm({ disputeId }: { disputeId: string }) {
  const [state, action, pending] = useActionState(addDisputeMessageAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <Field label="Add a message" htmlFor="body" error={state.fieldErrors?.body}>
        <Textarea id="body" name="body" maxLength={2000} required />
      </Field>
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
