"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import {
  assignVehicleAction,
  createDriverProfileAction,
  releaseVehicleAction,
  saveEmploymentAction,
  saveScheduleAction,
  setMembershipStatusAction,
} from "@/features/logistics-drivers/actions";
import type { DriverEmploymentView } from "@/features/logistics-drivers/queries";
import type { VehicleView } from "@/features/logistics-fleet/queries";

export function DriverForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createDriverProfileAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger sm:col-span-full">{state.message}</p>
      ) : null}
      <Field label="Full name" htmlFor="driverName" error={state.fieldErrors?.fullName}>
        <Input id="driverName" name="fullName" required />
      </Field>
      <Field label="Phone" htmlFor="driverPhone">
        <Input id="driverPhone" name="phone" />
      </Field>
      <Field label="License number" htmlFor="licenseNumber">
        <Input id="licenseNumber" name="licenseNumber" />
      </Field>
      <Field label="License expires" htmlFor="licenseExpiry">
        <Input id="licenseExpiry" name="licenseExpiresAt" type="date" />
      </Field>
      <Field label="Platform user ID (optional)" htmlFor="driverUser">
        <Input id="driverUser" name="userId" placeholder="uuid" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          Add driver
        </Button>
      </div>
    </form>
  );
}

export function MembershipStatusForm({
  companyId,
  membershipId,
  status,
}: {
  companyId: string;
  membershipId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(setMembershipStatusAction, initialFormState);
  const target = status === "ACTIVE" ? "SUSPENDED" : status === "SUSPENDED" ? "ENDED" : null;
  if (!target) return null;
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="toStatus" value={target} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {target === "SUSPENDED" ? "Suspend" : "End"}
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function EmploymentForm({
  companyId,
  membershipId,
  employment,
}: {
  companyId: string;
  membershipId: string;
  employment: DriverEmploymentView | null;
}) {
  const [state, action, pending] = useActionState(saveEmploymentAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <Field label="Arrangement" htmlFor="employmentType">
        <select
          id="employmentType"
          name="type"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue={employment?.type ?? "CONTRACTOR"}
        >
          <option value="CONTRACTOR">Contractor</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
      </Field>
      <Field label="Compensation model" htmlFor="mode">
        <select
          id="mode"
          name="mode"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue={employment?.mode ?? "PER_DELIVERY"}
        >
          <option value="FIXED_MONTHLY">Fixed monthly</option>
          <option value="PER_DELIVERY">Per delivery</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="DAILY">Daily</option>
          <option value="HYBRID">Hybrid</option>
        </select>
      </Field>
      <Field label="Start date" htmlFor="startDate">
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={employment?.startDate.slice(0, 10)}
          required
        />
      </Field>
      <Field label="End date" htmlFor="endDate">
        <Input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={employment?.endDate?.slice(0, 10)}
        />
      </Field>
      <Field label="Amount" htmlFor="amount" error={state.fieldErrors?.amount}>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          defaultValue={employment?.amount ?? ""}
        />
      </Field>
      <Field label="Rate (basis points)" htmlFor="rateBps" error={state.fieldErrors?.rateBps}>
        <Input
          id="rateBps"
          name="rateBps"
          inputMode="numeric"
          defaultValue={employment?.rateBps ?? ""}
        />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Save agreement
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}

export function ScheduleForm({
  companyId,
  membershipId,
}: {
  companyId: string;
  membershipId: string;
}) {
  const [state, action, pending] = useActionState(saveScheduleAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <Field label="Day (0=Sunday)" htmlFor="dayOfWeek" error={state.fieldErrors?.dayOfWeek}>
        <Input
          id="dayOfWeek"
          name="dayOfWeek"
          type="number"
          min={0}
          max={6}
          className="w-24"
          required
        />
      </Field>
      <Field label="From" htmlFor="startTime" error={state.fieldErrors?.startTime}>
        <Input id="startTime" name="startTime" placeholder="08:00" className="w-28" required />
      </Field>
      <Field label="To" htmlFor="endTime" error={state.fieldErrors?.endTime}>
        <Input id="endTime" name="endTime" placeholder="17:00" className="w-28" required />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isAvailable" defaultChecked className="size-4" /> Available
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>
        Add shift
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function AssignVehicleForm({
  companyId,
  membershipId,
  vehicles,
}: {
  companyId: string;
  membershipId: string;
  vehicles: VehicleView[];
}) {
  const [state, action, pending] = useActionState(assignVehicleAction, initialFormState);
  const available = vehicles.filter((vehicle) => vehicle.status === "ACTIVE");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <Field label="Vehicle" htmlFor="assignVehicle">
        <select
          id="assignVehicle"
          name="vehicleId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          required
        >
          <option value="">Select a vehicle</option>
          {available.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate} · {vehicle.type}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Assign vehicle
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function ReleaseVehicleForm({
  companyId,
  assignmentId,
}: {
  companyId: string;
  assignmentId: string;
}) {
  const [state, action, pending] = useActionState(releaseVehicleAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Release
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}
