"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideReturnAction } from "@/features/returns/actions";
import { initialFormState } from "@/features/identity/form-state";

export function ReturnDecisionForm({
  returnId,
  status,
}: {
  returnId: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";
}) {
  const [state, action, pending] = useActionState(decideReturnAction, initialFormState);

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-border pt-4">
      <input type="hidden" name="returnId" value={returnId} />
      <Input name="vendorNote" maxLength={500} placeholder="Message to the buyer (optional)" />

      {state.message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "REQUESTED" ? (
          <>
            <Button type="submit" name="decision" value="APPROVED" size="sm" disabled={pending}>
              Approve return
            </Button>
            <Button
              type="submit"
              name="decision"
              value="REJECTED"
              size="sm"
              variant="secondary"
              disabled={pending}
            >
              Decline
            </Button>
          </>
        ) : null}

        {status === "APPROVED" ? (
          <Button type="submit" name="decision" value="COMPLETED" size="sm" disabled={pending}>
            Mark received
          </Button>
        ) : null}

        {status === "REJECTED" || status === "COMPLETED" ? (
          <p className="text-xs text-muted-foreground">This return is closed.</p>
        ) : null}
      </div>
    </form>
  );
}
