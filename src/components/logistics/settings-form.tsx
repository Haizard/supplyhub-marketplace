"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveSettingsAction } from "@/features/logistics-companies/actions";
import type { CompanySettingsView } from "@/features/logistics-companies/queries";
import { initialFormState } from "@/features/identity/form-state";

export function SettingsForm({
  companyId,
  settings,
}: {
  companyId: string;
  settings: CompanySettingsView;
}) {
  const [state, action, pending] = useActionState(saveSettingsAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success">{state.message}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" htmlFor="currency" error={errors.currency}>
          <Input
            id="currency"
            name="currency"
            defaultValue={settings.currency}
            maxLength={3}
            required
          />
        </Field>
        <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
          <Input id="timezone" name="timezone" defaultValue={settings.timezone} required />
        </Field>
        <Field
          label="Notification email"
          htmlFor="notificationEmail"
          error={errors.notificationEmail}
        >
          <Input
            id="notificationEmail"
            name="notificationEmail"
            type="email"
            defaultValue={settings.notificationEmail ?? ""}
          />
        </Field>
        <Field
          label="Default service radius (km)"
          htmlFor="defaultServiceRadius"
          error={errors.defaultServiceRadius}
        >
          <Input
            id="defaultServiceRadius"
            name="defaultServiceRadius"
            inputMode="decimal"
            defaultValue={settings.defaultServiceRadius}
            required
          />
        </Field>
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
