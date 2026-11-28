"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import { submitProviderApplicationAction } from "@/features/providers/actions";
import { useT } from "@/i18n/client";

export interface ProviderApplicationFormProps {
  options: { value: string; label: string; disabled: boolean }[];
  defaults: {
    displayName: string;
    contactPhone: string;
    contactEmail: string;
    district: string;
  };
}

export function ProviderApplicationForm({ options, defaults }: ProviderApplicationFormProps) {
  const t = useT();
  const [state, action, pending] = useActionState(
    submitProviderApplicationAction,
    initialFormState,
  );
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

      <Field label={t("providers.identity")} htmlFor="entity" error={errors.entity}>
        <Select id="entity" name="entity" required defaultValue="">
          <option value="" disabled>
            {t("providers.identityPlaceholder")}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("providers.displayName")} htmlFor="displayName" error={errors.displayName}>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={defaults.displayName}
            maxLength={160}
            required
          />
        </Field>
        <Field label={t("providers.district")} htmlFor="district" error={errors.district}>
          <Input id="district" name="district" defaultValue={defaults.district} maxLength={120} />
        </Field>
        <Field
          label={t("providers.contactPhone")}
          htmlFor="contactPhone"
          error={errors.contactPhone}
        >
          <Input
            id="contactPhone"
            name="contactPhone"
            inputMode="tel"
            defaultValue={defaults.contactPhone}
            maxLength={40}
            required
          />
        </Field>
        <Field
          label={t("providers.contactEmail")}
          htmlFor="contactEmail"
          error={errors.contactEmail}
        >
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={defaults.contactEmail}
            maxLength={160}
            required
          />
        </Field>
      </div>

      <Field
        label={t("providers.summary")}
        htmlFor="summary"
        hint={t("providers.summaryHint")}
        error={errors.summary}
      >
        <Textarea id="summary" name="summary" maxLength={1000} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t("providers.identityRef")}
          htmlFor="identityReference"
          error={errors.identityReference}
        >
          <Input id="identityReference" name="identityReference" maxLength={160} required />
        </Field>
        <Field
          label={t("providers.licenceRef")}
          htmlFor="licenceReference"
          error={errors.licenceReference}
        >
          <Input id="licenceReference" name="licenceReference" maxLength={160} />
        </Field>
        <Field
          label={t("providers.certificateRef")}
          htmlFor="certificateReference"
          error={errors.certificateReference}
        >
          <Input id="certificateReference" name="certificateReference" maxLength={160} />
        </Field>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{t("providers.documentsNote")}</p>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? t("providers.submitting") : t("providers.submit")}
      </Button>
    </form>
  );
}
