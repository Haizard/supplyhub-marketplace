"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestServiceBookingAction } from "@/features/services/actions";
import { initialFormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

export function ServiceBookingForm({ listingId }: { listingId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(requestServiceBookingAction, initialFormState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      {state.status === "error" && state.message ? (
        <p className="rounded-md border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="rounded-md border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-success">
          {state.message}
        </p>
      ) : null}

      <Field label={t("services.scheduledAt")} htmlFor="scheduledAt">
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
      </Field>
      <Field label="Note" htmlFor="note" hint="Optional">
        <Input id="note" name="note" maxLength={1000} placeholder="Add a note for the provider" />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Requesting..." : t("services.book")}
      </Button>
    </form>
  );
}
