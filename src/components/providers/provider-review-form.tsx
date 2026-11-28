"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { initialFormState } from "@/features/identity/form-state";
import { decideProviderApplicationAction } from "@/features/providers/actions";
import { useT } from "@/i18n/client";

export function ProviderReviewForm({ applicationId }: { applicationId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(
    decideProviderApplicationAction,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />

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

      <Field label={t("providers.reviewNote")} htmlFor="note" error={errors.note}>
        <Textarea id="note" name="note" maxLength={1000} className="min-h-20" />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="APPROVED" variant="accent" disabled={pending}>
          {pending ? t("providers.deciding") : t("providers.approve")}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="REJECTED"
          variant="secondary"
          disabled={pending}
        >
          {t("providers.reject")}
        </Button>
      </div>
    </form>
  );
}
