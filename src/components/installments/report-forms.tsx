"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { initialFormState } from "@/features/identity/form-state";
import {
  openInstallmentDisputeAction,
  reconcileInstallmentBusinessAction,
  resolveInstallmentDisputeAction,
} from "@/features/installments/dispute-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function ReconcileInstallmentsForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(
    reconcileInstallmentBusinessAction,
    initialFormState,
  );
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="businessId" value={businessId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Run reconciliation
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function OpenInstallmentDisputeForm({
  businessId,
  agreementId,
  paymentId,
  compact,
}: {
  businessId?: string;
  agreementId: string;
  paymentId?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(openInstallmentDisputeAction, initialFormState);
  return (
    <form action={action} className="space-y-2">
      {businessId ? <input type="hidden" name="businessId" value={businessId} /> : null}
      <input type="hidden" name="agreementId" value={agreementId} />
      {paymentId ? <input type="hidden" name="paymentId" value={paymentId} /> : null}
      <Field
        label="Reason"
        htmlFor={`disputeReason-${agreementId}`}
        error={state.fieldErrors?.reason}
      >
        <Input
          id={`disputeReason-${agreementId}`}
          name="reason"
          className={compact ? "h-9" : ""}
          required
        />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Open dispute
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ResolveInstallmentDisputeForm({
  businessId,
  disputeId,
}: {
  businessId: string;
  disputeId: string;
}) {
  const [state, action, pending] = useActionState(
    resolveInstallmentDisputeAction,
    initialFormState,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="disputeId" value={disputeId} />
      <Input name="resolution" placeholder="Resolution note" className="h-9 w-48" required />
      <Button
        type="submit"
        name="decision"
        value="RESOLVE"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Resolve
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
