"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { createBusinessAction } from "@/features/business/actions";
import { useT } from "@/i18n/client";
import type { FormState } from "@/features/identity/form-state";

const initial: FormState = { status: "idle" };

export function CreateBusinessForm() {
  const t = useT();
  const [state, action] = useActionState(createBusinessAction, initial);

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <Field
        label={t("business.form.name")}
        htmlFor="name"
        error={state.status === "error" ? state.fieldErrors?.name : undefined}
      >
        <Input id="name" name="name" autoComplete="organization" maxLength={80} required />
      </Field>

      <Field
        label={t("business.form.handle")}
        htmlFor="slug"
        hint={t("business.form.handleHint")}
        error={state.status === "error" ? state.fieldErrors?.slug : undefined}
      >
        <Input
          id="slug"
          name="slug"
          placeholder="my-business"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          maxLength={64}
          required
        />
      </Field>

      <Field
        label={t("business.form.description")}
        htmlFor="description"
        error={state.status === "error" ? state.fieldErrors?.description : undefined}
      >
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        />
      </Field>

      <Field
        label={t("business.form.phone")}
        htmlFor="contactPhone"
        error={state.status === "error" ? state.fieldErrors?.contactPhone : undefined}
      >
        <Input id="contactPhone" name="contactPhone" type="tel" maxLength={30} />
      </Field>

      <Field
        label={t("business.form.email")}
        htmlFor="contactEmail"
        error={state.status === "error" ? state.fieldErrors?.contactEmail : undefined}
      >
        <Input id="contactEmail" name="contactEmail" type="email" maxLength={254} />
      </Field>

      <SubmitButton pendingLabel={t("business.form.createPending")}>
        {t("business.form.create")}
      </SubmitButton>
    </form>
  );
}
