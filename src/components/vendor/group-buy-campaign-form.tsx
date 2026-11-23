"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveCampaignAction } from "@/features/groupbuy/actions";
import { initialFormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

interface TierRow {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: string;
}

export function GroupBuyCampaignForm({ vendorId }: { vendorId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveCampaignAction, initialFormState);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const errors = state.fieldErrors ?? {};

  const updateTier = (index: number, patch: Partial<TierRow>) => {
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="tiers" value={JSON.stringify(tiers)} />

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
        <Input id="title" name="title" required />
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea id="description" name="description" maxLength={2000} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" htmlFor="currency" error={errors.currency}>
          <Input id="currency" name="currency" defaultValue="TZS" maxLength={3} required />
        </Field>
        <Field label={t("groupBuy.basePrice")} htmlFor="basePrice" error={errors.basePrice}>
          <Input id="basePrice" name="basePrice" inputMode="decimal" placeholder="0.00" required />
        </Field>
        <Field
          label={t("groupBuy.targetQuantity")}
          htmlFor="targetQuantity"
          error={errors.targetQuantity}
        >
          <Input id="targetQuantity" name="targetQuantity" type="number" min={1} required />
        </Field>
        <Field label="Maximum quantity" htmlFor="maxQuantity" error={errors.maxQuantity}>
          <Input id="maxQuantity" name="maxQuantity" type="number" min={1} />
        </Field>
        <Field label={t("groupBuy.startsAt")} htmlFor="startsAt" error={errors.startsAt}>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
        </Field>
        <Field label={t("groupBuy.endsAt")} htmlFor="endsAt" error={errors.endsAt}>
          <Input id="endsAt" name="endsAt" type="datetime-local" required />
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">{t("groupBuy.tiers")}</legend>
        {tiers.map((tier, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              aria-label="Minimum quantity"
              type="number"
              min={1}
              placeholder="Min qty"
              value={tier.minQuantity}
              onChange={(event) => updateTier(index, { minQuantity: Number(event.target.value) })}
            />
            <Input
              aria-label="Maximum quantity"
              type="number"
              min={1}
              placeholder="Max qty"
              value={tier.maxQuantity ?? ""}
              onChange={(event) =>
                updateTier(index, {
                  maxQuantity: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
            <Input
              aria-label="Unit price"
              inputMode="decimal"
              placeholder="Unit price"
              value={tier.unitPrice}
              onChange={(event) => updateTier(index, { unitPrice: event.target.value })}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            setTiers((current) => [
              ...current,
              { minQuantity: 1, maxQuantity: null, unitPrice: "" },
            ])
          }
        >
          Add tier
        </Button>
      </fieldset>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : "Create campaign"}
      </Button>
    </form>
  );
}
