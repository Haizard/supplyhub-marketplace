"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import {
  createInstallmentDocumentAction,
  decideInstallmentAmendmentAction,
  proposeInstallmentAmendmentAction,
  signInstallmentDocumentAction,
  submitInstallmentFinancingAction,
  voidInstallmentDocumentAction,
} from "@/features/installments/contract-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function CreateInstallmentDocumentForm({
  businessId,
  agreementId,
}: {
  businessId: string;
  agreementId: string;
}) {
  const [state, action, pending] = useActionState(
    createInstallmentDocumentAction,
    initialFormState,
  );
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Create contract version
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function SignInstallmentDocumentForm({
  businessId,
  documentId,
}: {
  businessId?: string;
  documentId: string;
}) {
  const [state, action, pending] = useActionState(signInstallmentDocumentAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      {businessId ? <input type="hidden" name="businessId" value={businessId} /> : null}
      <input type="hidden" name="documentId" value={documentId} />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Sign
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function VoidInstallmentDocumentForm({
  businessId,
  documentId,
}: {
  businessId: string;
  documentId: string;
}) {
  const [state, action, pending] = useActionState(voidInstallmentDocumentAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="documentId" value={documentId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Void
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ProposeAmendmentForm({
  businessId,
  agreementId,
}: {
  businessId: string;
  agreementId: string;
}) {
  const [state, action, pending] = useActionState(
    proposeInstallmentAmendmentAction,
    initialFormState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <Field
        label="Amendment reason"
        htmlFor={`amendReason-${agreementId}`}
        error={state.fieldErrors?.reason}
      >
        <Input id={`amendReason-${agreementId}`} name="reason" className="h-9" required />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Propose amendment
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function DecideAmendmentForm({ amendmentId }: { amendmentId: string }) {
  const [state, action, pending] = useActionState(
    decideInstallmentAmendmentAction,
    initialFormState,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="amendmentId" value={amendmentId} />
      <Button
        type="submit"
        name="decision"
        value="ACCEPT"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Accept
      </Button>
      <Button
        type="submit"
        name="decision"
        value="REJECT"
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        Reject
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function FinancingApplicationForm({
  businessId,
  agreementId,
  currency,
}: {
  businessId: string;
  agreementId: string;
  currency: string;
}) {
  const [state, action, pending] = useActionState(
    submitInstallmentFinancingAction,
    initialFormState,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <Input name="partnerCode" placeholder="Partner code" className="h-9 w-36" required />
      <Input
        name="requestedAmount"
        type="number"
        min="0"
        step="0.01"
        placeholder={`Amount (${currency})`}
        className="h-9 w-40"
        required
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Submit for review
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
