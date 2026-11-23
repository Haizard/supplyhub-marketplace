"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateCompanyAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";

export function CompanyProfileForm({
  company,
}: {
  company: {
    id: string;
    name: string;
    slug: string;
    description: string;
    city: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateCompanyAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={company.id} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success">{state.message}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" defaultValue={company.name} required />
        </Field>
        <Field label="URL slug" htmlFor="slug" error={errors.slug}>
          <Input id="slug" name="slug" defaultValue={company.slug} required />
        </Field>
        <Field label="City" htmlFor="city" error={errors.city}>
          <Input id="city" name="city" defaultValue={company.city ?? ""} />
        </Field>
        <Field label="Country code" htmlFor="countryCode" error={errors.countryCode}>
          <Input id="countryCode" name="countryCode" defaultValue="TZ" maxLength={2} />
        </Field>
      </div>
      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={company.description}
          maxLength={2000}
        />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
