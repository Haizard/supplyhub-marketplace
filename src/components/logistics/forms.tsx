"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  dispatchDeliveryAction,
  registerDeliveryAgentAction,
  setAgentPresenceAction,
} from "@/features/logistics/actions";

export function DispatchForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(dispatchDeliveryAction, initialFormState);
  return (
    <form action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" size="sm" disabled={pending}>
        Dispatch best available courier
      </Button>
      {state.message ? (
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function PresenceForm({ presence }: { presence: "ONLINE" | "OFFLINE" }) {
  const [state, action, pending] = useActionState(setAgentPresenceAction, initialFormState);
  return (
    <form action={action}>
      <input type="hidden" name="presence" value={presence === "ONLINE" ? "OFFLINE" : "ONLINE"} />
      <Button
        type="submit"
        size="sm"
        variant={presence === "ONLINE" ? "secondary" : "primary"}
        disabled={pending}
      >
        Go {presence === "ONLINE" ? "offline" : "online"}
      </Button>
      {state.message ? (
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function AgentRegistrationForm() {
  const [state, action, pending] = useActionState(registerDeliveryAgentAction, initialFormState);
  return (
    <form action={action} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">Become a courier</h2>
      <p className="text-sm text-muted-foreground">
        Register your details and a service area. An administrator reviews your profile before you
        can accept jobs.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="agent-name" error={state.fieldErrors?.name}>
          <Input id="agent-name" name="name" required minLength={2} maxLength={100} />
        </Field>
        <Field label="Phone" htmlFor="agent-phone" error={state.fieldErrors?.phone}>
          <Input id="agent-phone" name="phone" type="tel" required minLength={7} maxLength={30} />
        </Field>
        <Field label="Vehicle" htmlFor="agent-vehicle" error={state.fieldErrors?.vehicleType}>
          <Select id="agent-vehicle" name="vehicleType" defaultValue="MOTORCYCLE">
            <option value="BICYCLE">Bicycle</option>
            <option value="MOTORCYCLE">Motorcycle</option>
            <option value="CAR">Car</option>
            <option value="VAN">Van</option>
            <option value="WALKING">On foot</option>
          </Select>
        </Field>
        <Field label="Plate (optional)" htmlFor="agent-plate" error={state.fieldErrors?.plate}>
          <Input id="agent-plate" name="plate" maxLength={30} />
        </Field>
      </div>
      <Field label="Service area" htmlFor="agent-area" error={state.fieldErrors?.serviceAreaLabel}>
        <Input
          id="agent-area"
          name="serviceAreaLabel"
          required
          placeholder="e.g. Dar es Salaam — Kinondoni"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Area latitude" htmlFor="agent-lat" error={state.fieldErrors?.latitude}>
          <Input id="agent-lat" name="latitude" type="number" step="any" required />
        </Field>
        <Field label="Area longitude" htmlFor="agent-lng" error={state.fieldErrors?.longitude}>
          <Input id="agent-lng" name="longitude" type="number" step="any" required />
        </Field>
        <Field label="Radius (km)" htmlFor="agent-radius" error={state.fieldErrors?.radiusKm}>
          <Input
            id="agent-radius"
            name="radiusKm"
            type="number"
            step="any"
            min="1"
            max="200"
            defaultValue={10}
            required
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        Submit courier profile
      </Button>
      {state.message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function UseMyLocationButton({ targetPrefix }: { targetPrefix: string }) {
  function fill() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = document.getElementById(`${targetPrefix}-latitude`) as HTMLInputElement | null;
      const lng = document.getElementById(`${targetPrefix}-longitude`) as HTMLInputElement | null;
      if (lat) lat.value = String(position.coords.latitude);
      if (lng) lng.value = String(position.coords.longitude);
    });
  }
  return (
    <Button type="button" size="sm" variant="secondary" onClick={fill}>
      Use my current location
    </Button>
  );
}

export { Textarea };
