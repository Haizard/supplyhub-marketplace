"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import { createPosInstallmentAction } from "@/features/installments/pos-actions";

export function PosInstallmentForm({
  businessId,
  products,
}: {
  businessId: string;
  products: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createPosInstallmentAction, initialFormState);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="businessId" value={businessId} />
      <Field label="Product" htmlFor="posInstallmentProduct">
        <Select id="posInstallmentProduct" name="productId" required className="h-9">
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantity" htmlFor="posInstallmentQty">
        <Input
          id="posInstallmentQty"
          name="quantity"
          type="number"
          min="1"
          max="99"
          defaultValue={1}
          className="h-9"
          required
        />
      </Field>
      <Field label="Buyer email" htmlFor="posInstallmentBuyer">
        <Input id="posInstallmentBuyer" name="buyerEmail" type="email" className="h-9" required />
      </Field>
      <Field label="Deposit mode" htmlFor="posInstallmentDepositMode">
        <Select
          id="posInstallmentDepositMode"
          name="depositMode"
          defaultValue="PERCENTAGE"
          className="h-9"
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed</option>
        </Select>
      </Field>
      <Field label="Deposit value" htmlFor="posInstallmentDepositValue">
        <Input
          id="posInstallmentDepositValue"
          name="depositValue"
          type="number"
          min="0"
          step="0.01"
          defaultValue={20}
          className="h-9"
          required
        />
      </Field>
      <Field label="Frequency" htmlFor="posInstallmentFrequency">
        <Select
          id="posInstallmentFrequency"
          name="frequency"
          defaultValue="MONTHLY"
          className="h-9"
        >
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Biweekly</option>
          <option value="MONTHLY">Monthly</option>
        </Select>
      </Field>
      <Field label="Installments" htmlFor="posInstallmentCount">
        <Input
          id="posInstallmentCount"
          name="installmentCount"
          type="number"
          min="1"
          max="60"
          defaultValue={6}
          className="h-9"
          required
        />
      </Field>
      <Field label="First due date" htmlFor="posInstallmentDue">
        <Input id="posInstallmentDue" name="firstDueDate" type="date" className="h-9" required />
      </Field>
      <Field label="Possession" htmlFor="posInstallmentPossession">
        <Select
          id="posInstallmentPossession"
          name="possessionModel"
          defaultValue="AFTER_FULL_PAYMENT"
          className="h-9"
        >
          <option value="AFTER_FULL_PAYMENT">After full payment</option>
          <option value="IMMEDIATE">On deposit</option>
        </Select>
      </Field>
      <div className="flex items-end sm:col-span-full">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Create installment agreement
        </Button>
      </div>
      {state.message ? (
        <p
          className={`text-[10px] sm:col-span-full ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
