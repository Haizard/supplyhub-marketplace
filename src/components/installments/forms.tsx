"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  acceptInstallmentAction,
  cancelInstallmentAction,
  createInstallmentAgreementAction,
  saveInstallmentSettingsAction,
} from "@/features/installments/actions";
import type { InstallmentSettingsView } from "@/features/installments/queries";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function InstallmentSettingsForm({
  businessId,
  settings,
}: {
  businessId: string;
  settings: InstallmentSettingsView | null;
}) {
  const [state, action, pending] = useActionState(saveInstallmentSettingsAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="businessId" value={businessId} />
      <label className="flex items-center gap-2 text-sm sm:col-span-full">
        <input
          type="checkbox"
          name="enabled"
          value="true"
          defaultChecked={settings?.enabled ?? false}
          className="size-4"
        />
        Enable installment sales for this business
      </label>
      <Field label="Currency" htmlFor="instCurrency" error={state.fieldErrors?.currency}>
        <Input
          id="instCurrency"
          name="currency"
          defaultValue={settings?.currency ?? "TZS"}
          maxLength={3}
          required
        />
      </Field>
      <Field
        label="Deposit mode"
        htmlFor="depositMode"
        error={state.fieldErrors?.defaultDepositMode}
      >
        <Select
          id="depositMode"
          name="defaultDepositMode"
          defaultValue={settings?.defaultDepositMode ?? "PERCENTAGE"}
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </Select>
      </Field>
      <Field
        label="Default deposit value"
        htmlFor="depositValue"
        error={state.fieldErrors?.defaultDepositValue}
      >
        <Input
          id="depositValue"
          name="defaultDepositValue"
          type="number"
          min="0"
          step="0.01"
          defaultValue={settings?.defaultDepositValue ?? "20"}
          required
        />
      </Field>
      <Field label="Frequency" htmlFor="frequency" error={state.fieldErrors?.defaultFrequency}>
        <Select
          id="frequency"
          name="defaultFrequency"
          defaultValue={settings?.defaultFrequency ?? "MONTHLY"}
        >
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Biweekly</option>
          <option value="MONTHLY">Monthly</option>
        </Select>
      </Field>
      <Field
        label="Default installments"
        htmlFor="defaultCount"
        error={state.fieldErrors?.defaultInstallmentCount}
      >
        <Input
          id="defaultCount"
          name="defaultInstallmentCount"
          type="number"
          min="1"
          max="60"
          defaultValue={settings?.defaultInstallmentCount ?? 6}
          required
        />
      </Field>
      <Field
        label="Maximum installments"
        htmlFor="maxCount"
        error={state.fieldErrors?.maxInstallments}
      >
        <Input
          id="maxCount"
          name="maxInstallments"
          type="number"
          min="1"
          max="60"
          defaultValue={settings?.maxInstallments ?? 24}
          required
        />
      </Field>
      <Field label="Possession" htmlFor="possession" error={state.fieldErrors?.defaultPossession}>
        <Select
          id="possession"
          name="defaultPossession"
          defaultValue={settings?.defaultPossession ?? "AFTER_FULL_PAYMENT"}
        >
          <option value="AFTER_FULL_PAYMENT">After full payment</option>
          <option value="IMMEDIATE">On deposit</option>
        </Select>
      </Field>
      <Field label="Grace period (days)" htmlFor="grace" error={state.fieldErrors?.gracePeriodDays}>
        <Input
          id="grace"
          name="gracePeriodDays"
          type="number"
          min="0"
          max="365"
          defaultValue={settings?.gracePeriodDays ?? 0}
          required
        />
      </Field>
      <fieldset className="space-y-1 sm:col-span-full">
        <legend className="text-sm font-medium">
          Policy switches (recorded only, not applied)
        </legend>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="allowInterest"
            value="true"
            defaultChecked={settings?.allowInterest ?? false}
            className="size-4"
          />
          Allow interest (requires compliance review)
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="allowLateFees"
            value="true"
            defaultChecked={settings?.allowLateFees ?? false}
            className="size-4"
          />
          Allow late charges (requires compliance review)
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="allowAdvancePayments"
            value="true"
            defaultChecked={settings?.allowAdvancePayments ?? false}
            className="size-4"
          />
          Permit advance payments above the balance
        </label>
      </fieldset>
      <Field
        label="Terms summary (optional)"
        htmlFor="termsSummary"
        error={state.fieldErrors?.termsSummary}
      >
        <Input
          id="termsSummary"
          name="termsSummary"
          defaultValue={settings?.termsSummary ?? ""}
          className="sm:col-span-2"
        />
      </Field>
      <div className="sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Save installment settings
        </Button>
        <Feedback message={state.message} error={state.status === "error"} />
      </div>
    </form>
  );
}

export function CreateInstallmentForm({
  businessId,
  settings,
}: {
  businessId: string;
  settings: InstallmentSettingsView | null;
}) {
  const [state, action, pending] = useActionState(
    createInstallmentAgreementAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="businessId" value={businessId} />
      <Field
        label="Buyer email (platform account)"
        htmlFor="buyerEmail"
        error={state.fieldErrors?.buyerEmail}
      >
        <Input id="buyerEmail" name="buyerEmail" type="email" required />
      </Field>
      <Field label="Sale source" htmlFor="source" error={state.fieldErrors?.source}>
        <Select id="source" name="source" defaultValue="OFFLINE">
          <option value="OFFLINE">Offline / in-store sale</option>
          <option value="MARKETPLACE">Marketplace order</option>
        </Select>
      </Field>
      <Field
        label="Order ID (marketplace only)"
        htmlFor="orderId"
        error={state.fieldErrors?.orderId}
      >
        <Input id="orderId" name="orderId" placeholder="UUID" />
      </Field>
      <Field label="Product" htmlFor="itemName" error={state.fieldErrors?.itemName}>
        <Input id="itemName" name="itemName" required />
      </Field>
      <Field label="SKU (optional)" htmlFor="sku" error={state.fieldErrors?.sku}>
        <Input id="sku" name="sku" />
      </Field>
      <Field label="Quantity" htmlFor="quantity" error={state.fieldErrors?.quantity}>
        <Input id="quantity" name="quantity" type="number" min="1" defaultValue={1} required />
      </Field>
      <Field label="Cash price per unit" htmlFor="unitPrice" error={state.fieldErrors?.unitPrice}>
        <Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.01" required />
      </Field>
      <Field
        label="Deposit mode"
        htmlFor="agreementDepositMode"
        error={state.fieldErrors?.depositMode}
      >
        <Select
          id="agreementDepositMode"
          name="depositMode"
          defaultValue={settings?.defaultDepositMode ?? "PERCENTAGE"}
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </Select>
      </Field>
      <Field
        label="Deposit value"
        htmlFor="agreementDepositValue"
        error={state.fieldErrors?.depositValue}
      >
        <Input
          id="agreementDepositValue"
          name="depositValue"
          type="number"
          min="0"
          step="0.01"
          defaultValue={settings?.defaultDepositValue ?? "20"}
          required
        />
      </Field>
      <Field
        label="Installment frequency"
        htmlFor="agreementFrequency"
        error={state.fieldErrors?.frequency}
      >
        <Select
          id="agreementFrequency"
          name="frequency"
          defaultValue={settings?.defaultFrequency ?? "MONTHLY"}
        >
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Biweekly</option>
          <option value="MONTHLY">Monthly</option>
        </Select>
      </Field>
      <Field
        label="Number of installments"
        htmlFor="agreementCount"
        error={state.fieldErrors?.installmentCount}
      >
        <Input
          id="agreementCount"
          name="installmentCount"
          type="number"
          min="1"
          max={settings?.maxInstallments ?? 60}
          defaultValue={settings?.defaultInstallmentCount ?? 6}
          required
        />
      </Field>
      <Field
        label="Possession terms"
        htmlFor="agreementPossession"
        error={state.fieldErrors?.possessionModel}
      >
        <Select
          id="agreementPossession"
          name="possessionModel"
          defaultValue={settings?.defaultPossession ?? "AFTER_FULL_PAYMENT"}
        >
          <option value="AFTER_FULL_PAYMENT">After full payment</option>
          <option value="IMMEDIATE">On deposit</option>
        </Select>
      </Field>
      <Field label="First due date" htmlFor="firstDueDate" error={state.fieldErrors?.firstDueDate}>
        <Input id="firstDueDate" name="firstDueDate" type="date" required />
      </Field>
      <Field
        label="Late-payment policy (optional)"
        htmlFor="latePolicy"
        error={state.fieldErrors?.latePaymentPolicy}
      >
        <Input id="latePolicy" name="latePaymentPolicy" />
      </Field>
      <Field label="Notes (optional)" htmlFor="agreementNotes" error={state.fieldErrors?.notes}>
        <Input id="agreementNotes" name="notes" className="sm:col-span-2" />
      </Field>
      <div className="sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Send agreement to buyer
        </Button>
        <Feedback message={state.message} error={state.status === "error"} />
      </div>
    </form>
  );
}

export function AcceptInstallmentForm({ agreementId }: { agreementId: string }) {
  const [state, action, pending] = useActionState(acceptInstallmentAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="agreementId" value={agreementId} />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Accept terms
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function CancelInstallmentForm({
  businessId,
  agreementId,
}: {
  businessId: string;
  agreementId: string;
}) {
  const [state, action, pending] = useActionState(cancelInstallmentAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <Input name="reason" placeholder="Cancellation reason" className="h-9 w-48" required />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Cancel agreement
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
