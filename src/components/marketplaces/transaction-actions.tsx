"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import {
  cancelTransactionAction,
  completeTransactionAction,
} from "@/features/marketplaces/transactions/actions";
import { useT } from "@/i18n/client";

export function TransactionActions({
  transactionId,
  orderNumber,
  canCancel,
  canComplete,
}: {
  transactionId: string;
  orderNumber: string;
  canCancel: boolean;
  canComplete: boolean;
}) {
  const t = useT();
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelTransactionAction,
    initialFormState,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completeTransactionAction,
    initialFormState,
  );

  if (!canCancel && !canComplete) return null;

  return (
    <div className="space-y-4">
      {[cancelState, completeState].map((state, index) =>
        state.status === "error" && state.message ? (
          <p
            key={`error-${index}`}
            className="rounded-md border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {state.message}
          </p>
        ) : null,
      )}

      {canComplete ? (
        <form action={completeAction}>
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <Button type="submit" variant="accent" disabled={completePending}>
            {completePending ? t("transactions.completing") : t("transactions.complete")}
          </Button>
        </form>
      ) : null}

      {canCancel ? (
        <form action={cancelAction} className="space-y-3">
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <Field label={t("transactions.cancelReason")} htmlFor="cancelReason">
            <Input id="cancelReason" name="reason" maxLength={300} />
          </Field>
          <Button type="submit" variant="secondary" disabled={cancelPending}>
            {cancelPending ? t("transactions.cancelling") : t("transactions.cancel")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
