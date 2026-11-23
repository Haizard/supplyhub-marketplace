"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { registerCompanyAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";

export function CompanyForm() {
  const [state, action, pending] = useActionState(registerCompanyAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" required />
        </Field>
        <Field label="URL slug" htmlFor="slug" error={errors.slug}>
          <Input id="slug" name="slug" placeholder="arusha-express" required />
        </Field>
        <Field
          label="Registration number"
          htmlFor="registrationNumber"
          error={errors.registrationNumber}
        >
          <Input id="registrationNumber" name="registrationNumber" />
        </Field>
        <Field label="Contact email" htmlFor="contactEmail" error={errors.contactEmail}>
          <Input id="contactEmail" name="contactEmail" type="email" />
        </Field>
        <Field label="Contact phone" htmlFor="contactPhone" error={errors.contactPhone}>
          <Input id="contactPhone" name="contactPhone" />
        </Field>
        <Field label="City" htmlFor="city" error={errors.city}>
          <Input id="city" name="city" />
        </Field>
        <Field label="Country code" htmlFor="countryCode" error={errors.countryCode}>
          <Input id="countryCode" name="countryCode" defaultValue="TZ" maxLength={2} />
        </Field>
      </div>
      <Field label="Address" htmlFor="address" error={errors.address}>
        <Input id="address" name="address" />
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea id="description" name="description" maxLength={2000} />
      </Field>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Registering..." : "Register company"}
      </Button>
    </form>
  );
}
