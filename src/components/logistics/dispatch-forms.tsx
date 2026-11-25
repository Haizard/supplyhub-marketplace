"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  CompanyJobView,
  CompanyRequestView,
} from "@/features/logistics-company-dispatch/queries";
import {
  createCompanyRequestAction,
  dispatchCompanyJobAction,
  reassignCompanyJobAction,
  transitionCompanyJobAction,
  verifyCompanyDeliveryOtpAction,
} from "@/features/logistics-company-dispatch/actions";
import type { ContractView } from "@/features/logistics-contracts/queries";
import { initialFormState } from "@/features/identity/form-state";

type DriverOption = { id: string; name: string; vehiclePlate: string | null; activeJobs: number };

export function CompanyRequestForm({
  companyId,
  contracts,
}: {
  companyId: string;
  contracts: ContractView[];
}) {
  const [state, action, pending] = useActionState(createCompanyRequestAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger sm:col-span-full">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success sm:col-span-full">{state.message}</p>
      ) : null}
      <Field label="Contract (optional)" htmlFor="reqContract">
        <select
          id="reqContract"
          name="contractId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue=""
        >
          <option value="">No contract</option>
          {contracts
            .filter((c) => c.status === "ACTIVE")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.contractNumber} · {c.title}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Currency" htmlFor="reqCurrency">
        <Input id="reqCurrency" name="currency" defaultValue="TZS" maxLength={3} />
      </Field>
      <Field label="Pickup name" htmlFor="pickupName" error={errors.pickupName}>
        <Input id="pickupName" name="pickupName" required />
      </Field>
      <Field label="Pickup phone" htmlFor="pickupPhone">
        <Input id="pickupPhone" name="pickupPhone" />
      </Field>
      <Field label="Pickup address" htmlFor="pickupAddress" error={errors.pickupAddress}>
        <Input id="pickupAddress" name="pickupAddress" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pickup latitude" htmlFor="pickupLat" error={errors.pickupLatitude}>
          <Input id="pickupLat" name="pickupLatitude" inputMode="decimal" required />
        </Field>
        <Field label="Pickup longitude" htmlFor="pickupLon" error={errors.pickupLongitude}>
          <Input id="pickupLon" name="pickupLongitude" inputMode="decimal" required />
        </Field>
      </div>
      <Field label="Dropoff name" htmlFor="dropoffName" error={errors.dropoffName}>
        <Input id="dropoffName" name="dropoffName" required />
      </Field>
      <Field label="Dropoff phone" htmlFor="dropoffPhone">
        <Input id="dropoffPhone" name="dropoffPhone" />
      </Field>
      <Field label="Dropoff address" htmlFor="dropoffAddress" error={errors.dropoffAddress}>
        <Input id="dropoffAddress" name="dropoffAddress" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dropoff latitude" htmlFor="dropoffLat" error={errors.dropoffLatitude}>
          <Input id="dropoffLat" name="dropoffLatitude" inputMode="decimal" required />
        </Field>
        <Field label="Dropoff longitude" htmlFor="dropoffLon" error={errors.dropoffLongitude}>
          <Input id="dropoffLon" name="dropoffLongitude" inputMode="decimal" required />
        </Field>
      </div>
      <Field label="Distance (km)" htmlFor="reqDistance" error={errors.distanceKm}>
        <Input id="reqDistance" name="distanceKm" inputMode="decimal" required />
      </Field>
      <Field label="Delivery fee" htmlFor="reqFee" error={errors.fee}>
        <Input id="reqFee" name="fee" inputMode="decimal" required />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Note" htmlFor="reqNote">
          <Textarea id="reqNote" name="note" />
        </Field>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          Create request
        </Button>
      </div>
    </form>
  );
}

export function DispatchForm({
  companyId,
  request,
}: {
  companyId: string;
  request: CompanyRequestView;
}) {
  const [state, action, pending] = useActionState(dispatchCompanyJobAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="requestId" value={request.id} />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Dispatch
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function ReassignForm({
  companyId,
  job,
  drivers,
}: {
  companyId: string;
  job: CompanyJobView;
  drivers: DriverOption[];
}) {
  const [state, action, pending] = useActionState(reassignCompanyJobAction, initialFormState);
  const free = drivers.filter((driver) => driver.activeJobs === 0);
  if (free.length === 0) return null;
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="jobId" value={job.id} />
      <select
        name="membershipId"
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        defaultValue=""
      >
        <option value="" disabled>
          Reassign to
        </option>
        {free.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.name}
            {driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ""}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Reassign
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

const NEXT_STATUS: Record<string, string | null> = {
  ASSIGNED: "ACCEPTED",
  ACCEPTED: "TO_PICKUP",
  TO_PICKUP: "AT_PICKUP",
  AT_PICKUP: "TRANSIT",
  TRANSIT: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

export function CompanyJobStatusForm({
  companyId,
  job,
}: {
  companyId: string;
  job: CompanyJobView;
}) {
  const [state, action, pending] = useActionState(transitionCompanyJobAction, initialFormState);
  const next = NEXT_STATUS[job.status];
  if (!next) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="jobId" value={job.id} />
      <input type="hidden" name="toStatus" value={next} />
      <Input name="note" placeholder="Note (optional)" className="h-9 w-40" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {next}
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function CompanyOtpForm({ companyId, jobId }: { companyId: string; jobId: string }) {
  const [state, action, pending] = useActionState(verifyCompanyDeliveryOtpAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="jobId" value={jobId} />
      <Input name="code" placeholder="Hand-over code" className="w-40" required />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Verify code
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}
