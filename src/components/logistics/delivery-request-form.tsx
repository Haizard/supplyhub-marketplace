"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/field";
import { UseMyLocationButton } from "@/components/logistics/forms";
import { initialFormState } from "@/features/identity/form-state";
import { createDeliveryRequestAction } from "@/features/logistics/actions";

export function DeliveryRequestForm() {
  const [state, action, pending] = useActionState(createDeliveryRequestAction, initialFormState);

  return (
    <form action={action} className="space-y-6 rounded-2xl border border-border bg-surface p-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Pickup</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="pickupName" error={state.fieldErrors?.pickupName}>
            <Input id="pickupName" name="pickupName" required maxLength={100} />
          </Field>
          <Field label="Phone" htmlFor="pickupPhone" error={state.fieldErrors?.pickupPhone}>
            <Input id="pickupPhone" name="pickupPhone" type="tel" maxLength={30} />
          </Field>
        </div>
        <Field
          label="Pickup address"
          htmlFor="pickupAddress"
          error={state.fieldErrors?.pickupAddress}
        >
          <Input id="pickupAddress" name="pickupAddress" required maxLength={300} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Pickup latitude"
            htmlFor="pickup-latitude"
            error={state.fieldErrors?.latitude}
          >
            <Input id="pickup-latitude" name="pickup.latitude" type="number" step="any" required />
          </Field>
          <Field
            label="Pickup longitude"
            htmlFor="pickup-longitude"
            error={state.fieldErrors?.longitude}
          >
            <Input
              id="pickup-longitude"
              name="pickup.longitude"
              type="number"
              step="any"
              required
            />
          </Field>
        </div>
        <UseMyLocationButton targetPrefix="pickup" />
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="text-sm font-medium">Drop-off</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Recipient name"
            htmlFor="dropoffName"
            error={state.fieldErrors?.dropoffName}
          >
            <Input id="dropoffName" name="dropoffName" required maxLength={100} />
          </Field>
          <Field label="Phone" htmlFor="dropoffPhone" error={state.fieldErrors?.dropoffPhone}>
            <Input id="dropoffPhone" name="dropoffPhone" type="tel" maxLength={30} />
          </Field>
        </div>
        <Field
          label="Drop-off address"
          htmlFor="dropoffAddress"
          error={state.fieldErrors?.dropoffAddress}
        >
          <Input id="dropoffAddress" name="dropoffAddress" required maxLength={300} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Drop-off latitude" htmlFor="dropoff-latitude">
            <Input
              id="dropoff-latitude"
              name="dropoff.latitude"
              type="number"
              step="any"
              required
            />
          </Field>
          <Field label="Drop-off longitude" htmlFor="dropoff-longitude">
            <Input
              id="dropoff-longitude"
              name="dropoff.longitude"
              type="number"
              step="any"
              required
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Note for the courier (optional)" htmlFor="note">
        <Textarea
          id="note"
          name="note"
          maxLength={500}
          placeholder="Landmarks, gate code, timing…"
        />
      </Field>

      <div className="space-y-2">
        <Button type="submit" disabled={pending}>
          Request delivery
        </Button>
        {state.message ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function TrackLink({ jobId }: { jobId: string }) {
  return (
    <Link href={`/delivery/track/${jobId}`} className="text-sm underline underline-offset-2">
      Track this delivery
    </Link>
  );
}
