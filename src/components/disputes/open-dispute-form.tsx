"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { DisputableOrder } from "@/features/disputes/queries";
import { openDisputeAction } from "@/features/disputes/actions";
import { initialFormState } from "@/features/identity/form-state";

export function OpenDisputeForm({ orders }: { orders: DisputableOrder[] }) {
  const [state, action, pending] = useActionState(openDisputeAction, initialFormState);
  const [selection, setSelection] = useState(
    orders[0] ? `${orders[0].orderId}|${orders[0].vendorOrderId}` : "",
  );
  const selected = orders.find((order) => `${order.orderId}|${order.vendorOrderId}` === selection);
  const errors = state.fieldErrors ?? {};

  if (orders.length === 0) return null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={selected?.orderId ?? ""} />
      <input type="hidden" name="vendorOrderId" value={selected?.vendorOrderId ?? ""} />

      {state.status === "error" && state.message ? (
        <p className="rounded-md border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="rounded-md border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-success">
          {state.message}
        </p>
      ) : null}

      <Field label="Order line" htmlFor="orderLine">
        <select
          id="orderLine"
          className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
          value={selection}
          onChange={(event) => setSelection(event.target.value)}
        >
          {orders.map((order) => (
            <option
              key={`${order.orderId}|${order.vendorOrderId}`}
              value={`${order.orderId}|${order.vendorOrderId}`}
            >
              {order.orderNumber} · {order.vendorName} · {order.status}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reason" htmlFor="reason" error={errors.reason}>
        <Input id="reason" name="reason" maxLength={160} required />
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea id="description" name="description" maxLength={4000} required />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Opening..." : "Open dispute"}
      </Button>
    </form>
  );
}
