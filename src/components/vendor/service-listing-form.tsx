"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveServiceListingAction } from "@/features/services/actions";
import { initialFormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

export function ServiceListingForm({
  vendorId,
  listing,
}: {
  vendorId: string;
  listing?: {
    id: string;
    title: string;
    description: string;
    currency: string;
    unitPrice: string;
    durationMinutes: number;
    location: string;
    coverImageUrl: string | null;
  };
}) {
  const t = useT();
  const [state, action, pending] = useActionState(saveServiceListingAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="listingId" value={listing?.id ?? ""} />

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

      <Field label="Title" htmlFor="title" error={errors.title}>
        <Input id="title" name="title" defaultValue={listing?.title ?? ""} required />
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={listing?.description ?? ""}
          maxLength={2000}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" htmlFor="currency" error={errors.currency}>
          <Input
            id="currency"
            name="currency"
            defaultValue={listing?.currency ?? "TZS"}
            maxLength={3}
            required
          />
        </Field>
        <Field label={t("services.price")} htmlFor="unitPrice" error={errors.unitPrice}>
          <Input
            id="unitPrice"
            name="unitPrice"
            inputMode="decimal"
            defaultValue={listing?.unitPrice ?? ""}
            placeholder="0.00"
            required
          />
        </Field>
        <Field label="Duration (minutes)" htmlFor="durationMinutes" error={errors.durationMinutes}>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={listing?.durationMinutes ?? 60}
            required
          />
        </Field>
        <Field label={t("services.location")} htmlFor="location" error={errors.location}>
          <Input
            id="location"
            name="location"
            defaultValue={listing?.location ?? ""}
            maxLength={150}
          />
        </Field>
        <Field
          label="Cover image path (optional)"
          htmlFor="coverImageUrl"
          error={errors.coverImageUrl}
        >
          <Input
            id="coverImageUrl"
            name="coverImageUrl"
            defaultValue={listing?.coverImageUrl ?? ""}
            placeholder="/images/marketplace/services-pottery.jpg"
          />
        </Field>
      </div>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : t("services.save")}
      </Button>
    </form>
  );
}
