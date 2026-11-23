"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveCorridorAction } from "@/features/logistics-regional/actions";
import { initialFormState } from "@/features/identity/form-state";
import type { BranchOption } from "@/features/logistics-regional/queries";

export function CorridorForm({
  branches,
  corridor,
}: {
  branches: BranchOption[];
  corridor?: {
    id: string;
    name: string;
    description: string;
    originBranchId: string;
    destBranchId: string;
    currency: string;
    baseFee: string;
    perKmFee: string;
    estimatedKm: number;
    estimatedHours: number;
    stops: { branchId: string; stopOrder: number; label: string }[];
  };
}) {
  const [state, action] = useActionState(saveCorridorAction, initialFormState);
  const errors = state.fieldErrors;
  const editing = Boolean(corridor?.id);
  const prefix = editing ? "edit" : "new";

  return (
    <form action={action} className="space-y-5">
      {corridor?.id ? <input type="hidden" name="corridorId" value={corridor.id} /> : null}
      <FormMessage state={state} />

      <Field label="Name" htmlFor={`${prefix}-corridor-name`} error={errors?.name}>
        <Input
          id={`${prefix}-corridor-name`}
          name="name"
          defaultValue={corridor?.name}
          required
          maxLength={150}
          placeholder="Dar es Salaam to Dodoma Express"
          aria-invalid={errors?.name ? true : undefined}
          aria-describedby={errors?.name ? `${prefix}-corridor-name-error` : undefined}
        />
      </Field>

      <Field
        label="Description"
        htmlFor={`${prefix}-corridor-description`}
        hint="Optional"
        error={errors?.description}
      >
        <Textarea
          id={`${prefix}-corridor-description`}
          name="description"
          defaultValue={corridor?.description}
          maxLength={1000}
          placeholder="Route notes, transit details, or special instructions."
          aria-invalid={errors?.description ? true : undefined}
          aria-describedby={
            errors?.description ? `${prefix}-corridor-description-error` : undefined
          }
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Origin branch"
          htmlFor={`${prefix}-corridor-origin`}
          error={errors?.originBranchId}
        >
          <Select
            id={`${prefix}-corridor-origin`}
            name="originBranchId"
            defaultValue={corridor?.originBranchId}
            required
            aria-invalid={errors?.originBranchId ? true : undefined}
            aria-describedby={
              errors?.originBranchId ? `${prefix}-corridor-origin-error` : undefined
            }
          >
            <option value="">Select origin branch…</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
                {branch.city ? ` — ${branch.city}` : ""}
                {branch.isPrimary ? " (primary)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Destination branch"
          htmlFor={`${prefix}-corridor-dest`}
          error={errors?.destBranchId}
        >
          <Select
            id={`${prefix}-corridor-dest`}
            name="destBranchId"
            defaultValue={corridor?.destBranchId}
            required
            aria-invalid={errors?.destBranchId ? true : undefined}
            aria-describedby={errors?.destBranchId ? `${prefix}-corridor-dest-error` : undefined}
          >
            <option value="">Select destination branch…</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
                {branch.city ? ` — ${branch.city}` : ""}
                {branch.isPrimary ? " (primary)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Currency" htmlFor={`${prefix}-corridor-currency`} error={errors?.currency}>
          <Input
            id={`${prefix}-corridor-currency`}
            name="currency"
            defaultValue={corridor?.currency ?? "TZS"}
            required
            maxLength={3}
            placeholder="TZS"
            aria-invalid={errors?.currency ? true : undefined}
            aria-describedby={errors?.currency ? `${prefix}-corridor-currency-error` : undefined}
          />
        </Field>

        <Field label="Base fee" htmlFor={`${prefix}-corridor-base-fee`} error={errors?.baseFee}>
          <Input
            id={`${prefix}-corridor-base-fee`}
            name="baseFee"
            defaultValue={corridor?.baseFee}
            required
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={errors?.baseFee ? true : undefined}
            aria-describedby={errors?.baseFee ? `${prefix}-corridor-base-fee-error` : undefined}
          />
        </Field>

        <Field label="Per-km fee" htmlFor={`${prefix}-corridor-per-km`} error={errors?.perKmFee}>
          <Input
            id={`${prefix}-corridor-per-km`}
            name="perKmFee"
            defaultValue={corridor?.perKmFee}
            required
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={errors?.perKmFee ? true : undefined}
            aria-describedby={errors?.perKmFee ? `${prefix}-corridor-per-km-error` : undefined}
          />
        </Field>

        <Field
          label="Estimated distance (km)"
          htmlFor={`${prefix}-corridor-km`}
          error={errors?.estimatedKm}
        >
          <Input
            id={`${prefix}-corridor-km`}
            name="estimatedKm"
            type="number"
            defaultValue={corridor?.estimatedKm}
            required
            min={1}
            max={5000}
            placeholder="320"
            aria-invalid={errors?.estimatedKm ? true : undefined}
            aria-describedby={errors?.estimatedKm ? `${prefix}-corridor-km-error` : undefined}
          />
        </Field>

        <Field
          label="Estimated hours"
          htmlFor={`${prefix}-corridor-hours`}
          error={errors?.estimatedHours}
        >
          <Input
            id={`${prefix}-corridor-hours`}
            name="estimatedHours"
            type="number"
            defaultValue={corridor?.estimatedHours}
            required
            min={1}
            max={72}
            placeholder="6"
            aria-invalid={errors?.estimatedHours ? true : undefined}
            aria-describedby={errors?.estimatedHours ? `${prefix}-corridor-hours-error` : undefined}
          />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Intermediate stops</legend>
        <p className="text-xs text-muted-foreground">
          Optional. Add up to 10 stops along the route. Leave blank if the corridor is a direct
          route.
        </p>

        <div id="stop-rows" className="space-y-3">
          {corridor?.stops && corridor.stops.length > 0
            ? corridor.stops.map((stop, index) => (
                <div key={stop.branchId + index} className="grid gap-3 sm:grid-cols-[1fr_6rem_1fr]">
                  <Select name="stopBranchId" defaultValue={stop.branchId}>
                    <option value="">Select branch…</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    name="stopOrder"
                    type="number"
                    min={1}
                    defaultValue={stop.stopOrder}
                    placeholder="Order"
                  />
                  <Input
                    name="stopLabel"
                    defaultValue={stop.label}
                    maxLength={80}
                    placeholder="Label (optional)"
                  />
                </div>
              ))
            : null}
          {/* Empty stop row for new corridors / additional stops */}
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem_1fr]">
            <Select name="stopBranchId">
              <option value="">Select branch…</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Input name="stopOrder" type="number" min={1} placeholder="Order" />
            <Input name="stopLabel" maxLength={80} placeholder="Label (optional)" />
          </div>
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Saving…" className="w-auto">
        {editing ? "Save corridor" : "Create corridor"}
      </SubmitButton>
    </form>
  );
}
