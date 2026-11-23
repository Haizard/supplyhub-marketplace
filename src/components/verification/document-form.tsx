"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitVerificationDocumentAction } from "@/features/verification/actions";
import { initialFormState } from "@/features/identity/form-state";

export function VerificationDocumentForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(
    submitVerificationDocumentAction,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success">{state.message}</p>
      ) : null}
      <Field label="Document type" htmlFor="documentType" error={errors.documentType}>
        <select
          id="documentType"
          name="documentType"
          className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue="BUSINESS_REGISTRATION"
        >
          <option value="BUSINESS_REGISTRATION">Business registration</option>
          <option value="TAX_ID">Tax ID</option>
          <option value="ID_DOCUMENT">ID document</option>
          <option value="BANK_STATEMENT">Bank statement</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>
      <Field label="Reference" htmlFor="reference" error={errors.reference}>
        <Input id="reference" name="reference" maxLength={160} required />
      </Field>
      <Field label="Storage key" htmlFor="storageKey" error={errors.storageKey}>
        <Input
          id="storageKey"
          name="storageKey"
          placeholder="verification/business-id/document.pdf"
          required
        />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Submitting..." : "Submit document"}
      </Button>
    </form>
  );
}
