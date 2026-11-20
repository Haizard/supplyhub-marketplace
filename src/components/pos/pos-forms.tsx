"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/features/catalog/money";
import { useT } from "@/i18n/client";
import type { FormState } from "@/features/identity/form-state";
import { closeSessionAction, openSessionAction, recordExpenseAction } from "@/features/pos/actions";

const initial: FormState = { status: "idle" };

const lightInput =
  "h-10 rounded-xl border-[#e3def7] bg-white text-[#1b1730] placeholder:text-[#a29cba]";
const lightPrimaryButton =
  "h-10 rounded-full bg-[#11131d] text-[12px] font-semibold text-white hover:bg-[#1c2032]";

export function OpenSessionForm({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [state, action] = useActionState(openSessionAction, initial);

  return (
    <form action={action} className={compact ? "space-y-3" : "space-y-4"}>
      <FormMessage state={state} />
      <Field
        label={t("pos.openingFloat")}
        htmlFor="openingFloat"
        hint={compact ? undefined : t("pos.openingFloatHint")}
        error={state.status === "error" ? state.fieldErrors?.openingFloat : undefined}
      >
        <Input
          id="openingFloat"
          name="openingFloat"
          inputMode="decimal"
          placeholder="0"
          className={lightInput}
        />
      </Field>
      <SubmitButton pendingLabel={t("pos.openPending")} className={lightPrimaryButton}>
        {t("pos.openAction")}
      </SubmitButton>
    </form>
  );
}

export function CloseSessionForm({ expectedCashCents }: { expectedCashCents: number }) {
  const t = useT();
  const [state, action] = useActionState(closeSessionAction, initial);

  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <p className="text-xs text-[#4a4560]">
        {t("pos.expectedCash")}:{" "}
        <strong className="text-[#1b1730]">{formatMoney(expectedCashCents)}</strong>
      </p>
      <Field
        label={t("pos.countedCash")}
        htmlFor="countedCash"
        error={state.status === "error" ? state.fieldErrors?.countedCash : undefined}
      >
        <Input
          id="countedCash"
          name="countedCash"
          inputMode="decimal"
          required
          className={lightInput}
        />
      </Field>
      <Field label={t("pos.notes")} htmlFor="pos-notes">
        <Textarea
          id="pos-notes"
          name="notes"
          maxLength={300}
          className={`min-h-16 ${lightInput}`}
        />
      </Field>
      <SubmitButton pendingLabel={t("pos.closePending")} className={lightPrimaryButton}>
        {t("pos.closeAction")}
      </SubmitButton>
    </form>
  );
}

export function ExpenseForm() {
  const t = useT();
  const [state, action] = useActionState(recordExpenseAction, initial);

  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field
        label={t("pos.expenseCategory")}
        htmlFor="expense-category"
        error={state.status === "error" ? state.fieldErrors?.category : undefined}
      >
        <Input
          id="expense-category"
          name="category"
          maxLength={60}
          required
          className={lightInput}
        />
      </Field>
      <Field
        label={t("pos.expenseDescription")}
        htmlFor="expense-description"
        error={state.status === "error" ? state.fieldErrors?.description : undefined}
      >
        <Input
          id="expense-description"
          name="description"
          maxLength={200}
          required
          className={lightInput}
        />
      </Field>
      <Field
        label={t("pos.expenseAmount")}
        htmlFor="expense-amount"
        error={state.status === "error" ? state.fieldErrors?.amount : undefined}
      >
        <Input
          id="expense-amount"
          name="amount"
          inputMode="decimal"
          required
          className={lightInput}
        />
      </Field>
      <SubmitButton pendingLabel={t("pos.expensePending")} className={lightPrimaryButton}>
        {t("pos.expenseAction")}
      </SubmitButton>
    </form>
  );
}
