"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { archiveServiceListingAction } from "@/features/services/actions";
import { initialFormState } from "@/features/identity/form-state";

export function ServiceListingArchiveForm({
  listingId,
  archived,
}: {
  listingId: string;
  archived: boolean;
}) {
  const [state, action, pending] = useActionState(archiveServiceListingAction, initialFormState);

  if (archived) return null;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="listingId" value={listingId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Archiving..." : "Archive"}
      </Button>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}
