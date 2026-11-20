"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import { updateVendorOrderStatusAction } from "@/features/checkout/vendor-actions";
import { nextVendorOrderStatus } from "@/features/checkout/status";

export function OrderStatusForm({ orderId, status }: { orderId: string; status: string }) {
  const [state, action, pending] = useActionState(updateVendorOrderStatusAction, initialFormState);
  const next = nextVendorOrderStatus(status as Parameters<typeof nextVendorOrderStatus>[0]);
  if (!next) return <span className="text-xs text-muted-foreground">No further action</span>;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="vendorOrderId" value={orderId} />
      <input type="hidden" name="status" value={next} />
      {next === "SHIPPED" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Carrier</span>
            <Input
              name="carrier"
              maxLength={80}
              placeholder="Sendy, DHL, local courier…"
              required
            />
            {state.fieldErrors?.carrier ? (
              <span className="block text-xs text-danger">{state.fieldErrors.carrier}</span>
            ) : null}
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Tracking number</span>
            <Input name="trackingNumber" maxLength={80} placeholder="Tracking reference" required />
            {state.fieldErrors?.trackingNumber ? (
              <span className="block text-xs text-danger">{state.fieldErrors.trackingNumber}</span>
            ) : null}
          </label>
          <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
            <span>Tracking link (optional)</span>
            <Input
              name="trackingUrl"
              type="url"
              maxLength={500}
              placeholder="https://carrier.example/track/…"
            />
            {state.fieldErrors?.trackingUrl ? (
              <span className="block text-xs text-danger">{state.fieldErrors.trackingUrl}</span>
            ) : null}
          </label>
        </div>
      ) : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : `Mark ${next.toLowerCase()}`}
      </Button>
      {state.message ? (
        <p
          aria-live="polite"
          className={state.status === "error" ? "text-xs text-danger" : "text-xs text-success"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
