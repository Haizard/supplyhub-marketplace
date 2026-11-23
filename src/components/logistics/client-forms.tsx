"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import type { ClientDetailView } from "@/features/logistics-clients/queries";
import {
  saveClientAction,
  saveContactAction,
  updateRelationshipStatusAction,
} from "@/features/logistics-clients/actions";

export function ClientForm({
  companyId,
  client,
}: {
  companyId: string;
  client?: ClientDetailView;
}) {
  const [state, action, pending] = useActionState(saveClientAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="clientId" value={client?.id ?? ""} />

      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger sm:col-span-full">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success sm:col-span-full">{state.message}</p>
      ) : null}

      <Field label="Client name" htmlFor="clientName" error={errors.name}>
        <Input id="clientName" name="name" defaultValue={client?.name ?? ""} required />
      </Field>
      <Field label="Business name" htmlFor="businessName">
        <Input id="businessName" name="businessName" defaultValue={client?.businessName ?? ""} />
      </Field>
      <Field label="Phone" htmlFor="clientPhone">
        <Input id="clientPhone" name="phone" defaultValue={client?.phone ?? ""} />
      </Field>
      <Field label="Email" htmlFor="clientEmail" error={errors.email}>
        <Input id="clientEmail" name="email" type="email" defaultValue={client?.email ?? ""} />
      </Field>
      <Field label="City" htmlFor="clientCity">
        <Input id="clientCity" name="city" defaultValue={client?.city ?? ""} />
      </Field>
      <Field label="Account code" htmlFor="accountCode">
        <Input id="accountCode" name="accountCode" defaultValue={client?.accountCode ?? ""} />
      </Field>
      <Field label="Address" htmlFor="clientAddress" error={errors.address}>
        <Input id="clientAddress" name="address" defaultValue={client?.address ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" htmlFor="clientLat" error={errors.latitude}>
          <Input id="clientLat" name="latitude" defaultValue={client?.latitude ?? ""} />
        </Field>
        <Field label="Longitude" htmlFor="clientLon" error={errors.longitude}>
          <Input id="clientLon" name="longitude" defaultValue={client?.longitude ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Service notes" htmlFor="serviceNotes">
          <Textarea
            id="serviceNotes"
            name="serviceNotes"
            defaultValue={client?.serviceNotes ?? ""}
          />
        </Field>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving..." : client ? "Save client" : "Register client"}
        </Button>
      </div>
    </form>
  );
}

export function ContactForm({
  companyId,
  clientId,
  contact,
}: {
  companyId: string;
  clientId: string;
  contact?: {
    id: string;
    name: string;
    role: string;
    phone: string;
    email: string;
    isPrimary: boolean;
  };
}) {
  const [state, action, pending] = useActionState(saveContactAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="contactId" value={contact?.id ?? ""} />
      <Field label="Name" htmlFor="contactName" error={state.fieldErrors?.name}>
        <Input id="contactName" name="name" defaultValue={contact?.name ?? ""} required />
      </Field>
      <Field label="Role" htmlFor="contactRole">
        <Input id="contactRole" name="role" defaultValue={contact?.role ?? ""} />
      </Field>
      <Field label="Phone" htmlFor="contactPhone">
        <Input id="contactPhone" name="phone" defaultValue={contact?.phone ?? ""} />
      </Field>
      <Field label="Email" htmlFor="contactEmail" error={state.fieldErrors?.email}>
        <Input id="contactEmail" name="email" type="email" defaultValue={contact?.email ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPrimary"
          defaultChecked={contact?.isPrimary ?? false}
          className="size-4"
        />
        Primary contact
      </label>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {contact ? "Save contact" : "Add contact"}
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}

export function RelationshipStatusForm({
  companyId,
  clientId,
  status,
}: {
  companyId: string;
  clientId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updateRelationshipStatusAction, initialFormState);
  const target = status === "PENDING" ? "ACTIVE" : status === "ACTIVE" ? "SUSPENDED" : "ENDED";
  if (status === "ENDED") return null;
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="toStatus" value={target} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {target === "ACTIVE" ? "Activate" : target === "SUSPENDED" ? "Suspend" : "End"}
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}
