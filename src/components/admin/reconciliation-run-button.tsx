"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { runReconciliationAction } from "@/features/reconciliation/actions";
import { initialFormState } from "@/features/identity/form-state";

const initial = initialFormState as
  { status: "idle" } | Awaited<ReturnType<typeof runReconciliationAction>>;

export function ReconciliationRunButton() {
  const [state, action, pending] = useActionState(runReconciliationAction, initial);

  return (
    <div className="space-y-2">
      <form action={action}>
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Reconciling..." : "Run reconciliation"}
        </Button>
      </form>
      {state.status !== "idle" ? (
        <p className={state.status === "error" ? "text-sm text-danger" : "text-sm text-success"}>
          {state.status === "error"
            ? state.message
            : `${state.runNumber}: checked ${state.checkedCount}, ${state.findingCount} finding(s).`}
        </p>
      ) : null}
    </div>
  );
}
