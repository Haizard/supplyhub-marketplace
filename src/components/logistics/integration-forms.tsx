"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createKeyAction,
  revokeKeyAction,
  saveExternalStoreAction,
  saveWebhookEndpointAction,
  setEndpointStatusAction,
} from "@/features/logistics-api/actions";
import { initialFormState } from "@/features/identity/form-state";

const SCOPES = ["delivery.requests:write", "delivery.requests:read", "webhooks:write"];
const EVENTS = ["delivery.created", "delivery.status_changed", "delivery.delivered"];

export function ApiKeyForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createKeyAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Key name" htmlFor="keyName" error={state.fieldErrors?.name}>
        <Input id="keyName" name="name" required />
      </Field>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Scopes</legend>
        {SCOPES.map((scope) => (
          <label key={scope} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="scopes"
              value={scope}
              className="size-4"
              defaultChecked={scope !== "webhooks:write"}
            />
            <span className="font-mono">{scope}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="accent" disabled={pending}>
        Create API key
      </Button>
      {state.status === "success" && state.message ? (
        <p className="text-xs break-all text-success">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-xs text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}

export function RevokeKeyForm({ companyId, keyId }: { companyId: string; keyId: string }) {
  const [state, action, pending] = useActionState(revokeKeyAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="keyId" value={keyId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Revoke
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function WebhookEndpointForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(saveWebhookEndpointAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="HTTPS endpoint URL" htmlFor="endpointUrl" error={state.fieldErrors?.url}>
        <Input
          id="endpointUrl"
          name="url"
          type="url"
          placeholder="https://store.example.com/webhooks/supplyhub"
          required
        />
      </Field>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Events</legend>
        {EVENTS.map((event) => (
          <label key={event} className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="events" value={event} className="size-4" defaultChecked />
            <span className="font-mono">{event}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="secondary" disabled={pending}>
        Add endpoint
      </Button>
      {state.status === "success" && state.message ? (
        <p className="text-xs break-all text-success">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-xs text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}

export function EndpointStatusForm({
  companyId,
  endpointId,
  status,
}: {
  companyId: string;
  endpointId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(setEndpointStatusAction, initialFormState);
  const next = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="endpointId" value={endpointId} />
      <input type="hidden" name="status" value={next} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {next === "PAUSED" ? "Pause" : "Activate"}
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function ExternalStoreForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(saveExternalStoreAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Platform" htmlFor="storePlatform" error={state.fieldErrors?.platform}>
        <Input id="storePlatform" name="platform" placeholder="Shopify" required />
      </Field>
      <Field
        label="External store ID"
        htmlFor="storeExternalId"
        error={state.fieldErrors?.externalStoreId}
      >
        <Input id="storeExternalId" name="externalStoreId" required />
      </Field>
      <Field label="Display name" htmlFor="storeName" error={state.fieldErrors?.name}>
        <Input id="storeName" name="name" required />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Connect store
        </Button>
      </div>
      {state.status === "success" && state.message ? (
        <p className="text-xs break-all text-success sm:col-span-full">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-xs text-danger sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}
