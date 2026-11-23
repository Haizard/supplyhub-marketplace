"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { updateCorridorStatusAction } from "@/features/logistics-regional/actions";
import { initialFormState } from "@/features/identity/form-state";

export function CorridorStatusAction({
  corridorId,
  currentStatus,
}: {
  corridorId: string;
  currentStatus: "DRAFT" | "ACTIVE" | "INACTIVE";
}) {
  const [state, action] = useActionState(updateCorridorStatusAction, initialFormState);

  const canActivate = currentStatus === "DRAFT" || currentStatus === "INACTIVE";
  const canDeactivate = currentStatus === "ACTIVE";

  if (!canActivate && !canDeactivate) {
    return null;
  }

  const toStatus = canActivate ? "ACTIVE" : "INACTIVE";
  const label = canActivate ? "Activate corridor" : "Deactivate corridor";
  const pendingLabel = canActivate ? "Activating…" : "Deactivating…";
  const confirmMessage = canActivate
    ? "Activate this corridor? It will become publicly browsable."
    : "Deactivate this corridor? It will be hidden from the storefront.";

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={corridorId} />
      <input type="hidden" name="toStatus" value={toStatus} />
      <FormMessage state={state} />
      <SubmitButton
        pendingLabel={pendingLabel}
        variant={canActivate ? "accent" : "secondary"}
        className="w-auto"
        size="sm"
      >
        {label}
      </SubmitButton>
    </form>
  );
}
