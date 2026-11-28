"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import { createTransactionAction } from "@/features/marketplaces/transactions/actions";
import { useT } from "@/i18n/client";

export interface TransactionFormProps {
  orderNumber: string;
  defaults: {
    pickupName: string;
    pickupAddress: string;
    pickupLatitude: string;
    pickupLongitude: string;
    dropoffName: string;
    dropoffAddress: string;
    dropoffLatitude: string;
    dropoffLongitude: string;
  };
  companies: { id: string; name: string; city: string | null }[];
  services: { id: string; title: string; vendorName: string; priceLabel: string }[];
}

export function TransactionForm({
  orderNumber,
  defaults,
  companies,
  services,
}: TransactionFormProps) {
  const t = useT();
  const [state, action, pending] = useActionState(createTransactionAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="orderNumber" value={orderNumber} />

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

      {companies.length === 0 ? (
        <p className="rounded-md border border-clay/25 bg-clay-soft px-3.5 py-2.5 text-sm text-clay">
          {t("transactions.companyEmpty")}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("transactions.company")} htmlFor="companyId" error={errors.companyId}>
          <Select id="companyId" name="companyId" required defaultValue="">
            <option value="" disabled>
              {t("transactions.companyPlaceholder")}
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.city ? `${company.name} · ${company.city}` : company.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("transactions.service")}
          htmlFor="serviceListingId"
          error={errors.serviceListingId}
        >
          <Select id="serviceListingId" name="serviceListingId" defaultValue="">
            <option value="">{t("transactions.serviceNone")}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title} · {service.vendorName} · {service.priceLabel}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("transactions.scheduledAt")}
          htmlFor="scheduledAt"
          error={errors.scheduledAt}
        >
          <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("transactions.pickupName")} htmlFor="pickupName" error={errors.pickupName}>
          <Input
            id="pickupName"
            name="pickupName"
            defaultValue={defaults.pickupName}
            maxLength={100}
            required
          />
        </Field>
        <Field
          label={t("transactions.pickupAddress")}
          htmlFor="pickupAddress"
          error={errors.pickupAddress}
        >
          <Input
            id="pickupAddress"
            name="pickupAddress"
            defaultValue={defaults.pickupAddress}
            maxLength={300}
            required
          />
        </Field>
        <Field
          label={`${t("transactions.latitude")} · ${t("transactions.pickupName")}`}
          htmlFor="pickupLatitude"
          error={errors.pickupLatitude}
        >
          <Input
            id="pickupLatitude"
            name="pickupLatitude"
            inputMode="decimal"
            defaultValue={defaults.pickupLatitude}
            required
          />
        </Field>
        <Field
          label={`${t("transactions.longitude")} · ${t("transactions.pickupName")}`}
          htmlFor="pickupLongitude"
          error={errors.pickupLongitude}
        >
          <Input
            id="pickupLongitude"
            name="pickupLongitude"
            inputMode="decimal"
            defaultValue={defaults.pickupLongitude}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("transactions.dropoffName")}
          htmlFor="dropoffName"
          error={errors.dropoffName}
        >
          <Input
            id="dropoffName"
            name="dropoffName"
            defaultValue={defaults.dropoffName}
            maxLength={100}
            required
          />
        </Field>
        <Field
          label={t("transactions.dropoffAddress")}
          htmlFor="dropoffAddress"
          error={errors.dropoffAddress}
        >
          <Input
            id="dropoffAddress"
            name="dropoffAddress"
            defaultValue={defaults.dropoffAddress}
            maxLength={300}
            required
          />
        </Field>
        <Field
          label={`${t("transactions.latitude")} · ${t("transactions.dropoffName")}`}
          htmlFor="dropoffLatitude"
          error={errors.dropoffLatitude}
        >
          <Input
            id="dropoffLatitude"
            name="dropoffLatitude"
            inputMode="decimal"
            defaultValue={defaults.dropoffLatitude}
            required
          />
        </Field>
        <Field
          label={`${t("transactions.longitude")} · ${t("transactions.dropoffName")}`}
          htmlFor="dropoffLongitude"
          error={errors.dropoffLongitude}
        >
          <Input
            id="dropoffLongitude"
            name="dropoffLongitude"
            inputMode="decimal"
            defaultValue={defaults.dropoffLongitude}
            required
          />
        </Field>
      </div>

      <Field label={t("transactions.note")} htmlFor="note" error={errors.note}>
        <Textarea id="note" name="note" maxLength={500} />
      </Field>

      <Button type="submit" variant="accent" disabled={pending || companies.length === 0}>
        {pending ? t("transactions.submitting") : t("transactions.submit")}
      </Button>
    </form>
  );
}
