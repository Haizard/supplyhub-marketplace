"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { CompanyBranchView } from "@/features/logistics-companies/queries";
import { saveBranchAction } from "@/features/logistics-companies/actions";
import { initialFormState } from "@/features/identity/form-state";

export function BranchForm({
  companyId,
  branch,
}: {
  companyId: string;
  branch?: CompanyBranchView;
}) {
  const [state, action, pending] = useActionState(saveBranchAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branch?.id ?? ""} />

      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success">{state.message}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Branch name" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" defaultValue={branch?.name ?? ""} required />
        </Field>
        <Field label="Branch code" htmlFor="branchCode" error={errors.branchCode}>
          <Input
            id="branchCode"
            name="branchCode"
            placeholder="DAR-01"
            defaultValue={branch?.branchCode ?? ""}
            required
          />
        </Field>
        <Field label="City" htmlFor="city" error={errors.city}>
          <Input id="city" name="city" defaultValue={branch?.city ?? ""} />
        </Field>
        <Field label="Address" htmlFor="address" error={errors.address}>
          <Input id="address" name="address" defaultValue={branch?.address ?? ""} />
        </Field>
        <Field label="Latitude" htmlFor="latitude" error={errors.latitude}>
          <Input id="latitude" name="latitude" defaultValue={branch?.latitude ?? ""} />
        </Field>
        <Field label="Longitude" htmlFor="longitude" error={errors.longitude}>
          <Input id="longitude" name="longitude" defaultValue={branch?.longitude ?? ""} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isPrimary"
            defaultChecked={branch?.isPrimary ?? false}
            className="size-4"
          />
          Primary branch
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={branch?.isActive ?? true}
            className="size-4"
          />
          Active
        </label>
      </div>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : branch ? "Save branch" : "Add branch"}
      </Button>
    </form>
  );
}
