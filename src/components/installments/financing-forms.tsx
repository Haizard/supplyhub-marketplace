"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import {
  acceptInstallmentFinancingAction,
  decideInstallmentFinancingAction,
  recordInstallmentFundingAction,
} from "@/features/installments/financing-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function DecideFinancingForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(
    decideInstallmentFinancingAction,
    initialFormState,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Input
        name="offeredAmount"
        type="number"
        min="0"
        step="0.01"
        placeholder="Offered amount"
        className="h-9 w-36"
      />
      <Input name="note" placeholder="Decision note" className="h-9 w-48" required />
      <Button
        type="submit"
        name="decision"
        value="APPROVE"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Approve
      </Button>
      <Button
        type="submit"
        name="decision"
        value="DECLINE"
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        Decline
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function AcceptFinancingForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(
    acceptInstallmentFinancingAction,
    initialFormState,
  );
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Accept offer
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function FundFinancingForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(recordInstallmentFundingAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Input
        name="providerReference"
        placeholder="Partner funding reference"
        className="h-9 w-56"
        required
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Record funding
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
