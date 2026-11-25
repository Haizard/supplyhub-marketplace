"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  decideOptimizationAction,
  requestOptimizationAction,
} from "@/features/logistics-optimization/actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function OptimizationRequestForm({
  companyId,
  requests,
}: {
  companyId: string;
  requests: { id: string; requestNumber: string; pickupName: string; dropoffName: string }[];
}) {
  const [state, action, pending] = useActionState(requestOptimizationAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Field
        label="Pending delivery request"
        htmlFor="optimizeRequest"
        error={state.fieldErrors?.requestId}
      >
        <Select id="optimizeRequest" name="requestId" required>
          {requests.map((request) => (
            <option key={request.id} value={request.id}>
              {request.requestNumber} · {request.pickupName} → {request.dropoffName}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        Generate advisory ranking
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function OptimizationDecisionForm({
  companyId,
  suggestionId,
  status,
}: {
  companyId: string;
  suggestionId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(decideOptimizationAction, initialFormState);
  if (status !== "PENDING") return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="suggestionId" value={suggestionId} />
      <Button
        type="submit"
        name="decision"
        value="ACCEPT"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Accept suggestion
      </Button>
      <Button
        type="submit"
        name="decision"
        value="USE_BASELINE"
        size="sm"
        variant="secondary"
        disabled={pending}
      >
        Use baseline
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
