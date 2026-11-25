"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  recordInstallmentCashPaymentAction,
  refundInstallmentPaymentAction,
  startInstallmentPaymentAction,
} from "@/features/installments/payment-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function StartInstallmentPaymentForm({
  agreementId,
  suggestedAmount,
}: {
  agreementId: string;
  suggestedAmount: string;
}) {
  const [state, action, pending] = useActionState(startInstallmentPaymentAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="agreementId" value={agreementId} />
      <Field label="Amount" htmlFor="paymentAmount" error={state.fieldErrors?.amount}>
        <Input
          id="paymentAmount"
          name="amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={suggestedAmount}
          required
        />
      </Field>
      <Field label="Method" htmlFor="paymentMethod" error={state.fieldErrors?.method}>
        <Select id="paymentMethod" name="method" defaultValue="MPESA">
          <option value="MPESA">M-Pesa</option>
          <option value="TIGOPESA">Tigo Pesa</option>
          <option value="AIRTEL">Airtel Money</option>
          <option value="HALOPESA">Halopesa</option>
          <option value="CARD">Card</option>
        </Select>
      </Field>
      <Field label="Phone (optional)" htmlFor="paymentPhone" error={state.fieldErrors?.phone}>
        <Input id="paymentPhone" name="phone" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          Start payment
        </Button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-full">
        A payment is recorded only after a verified provider callback. Returning from checkout is
        not sufficient.
      </p>
      {state.message ? (
        <p className={state.status === "error" ? "text-xs text-danger" : "text-xs text-success"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function RecordCashPaymentForm({
  businessId,
  agreementId,
}: {
  businessId: string;
  agreementId: string;
}) {
  const [state, action, pending] = useActionState(
    recordInstallmentCashPaymentAction,
    initialFormState,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <Input
        name="amount"
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount"
        className="h-9 w-32"
        required
      />
      <Select name="method" className="h-9 w-28" defaultValue="CASH">
        <option value="CASH">Cash</option>
        <option value="BANK">Bank</option>
      </Select>
      <Input name="note" placeholder="Note (optional)" className="h-9 w-40" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Record payment
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function RefundPaymentForm({
  businessId,
  paymentId,
}: {
  businessId: string;
  paymentId: string;
}) {
  const [state, action, pending] = useActionState(refundInstallmentPaymentAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <Input name="reason" placeholder="Refund reason" className="h-9 w-40" required />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Refund
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
