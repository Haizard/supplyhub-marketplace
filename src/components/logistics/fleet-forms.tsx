"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/features/identity/form-state";
import type {
  FleetView,
  VehicleDocumentView,
  VehicleView,
} from "@/features/logistics-fleet/queries";
import {
  reviewDocumentAction,
  saveDocumentAction,
  saveFleetAction,
  saveMaintenanceAction,
  saveVehicleAction,
  updateVehicleStatusAction,
} from "@/features/logistics-fleet/actions";

export function FleetForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(saveFleetAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Fleet name" htmlFor="fleetName" error={state.fieldErrors?.name}>
        <Input id="fleetName" name="name" required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving..." : "Add fleet"}
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function VehicleForm({ companyId, fleets }: { companyId: string; fleets: FleetView[] }) {
  const [state, action, pending] = useActionState(saveVehicleAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger sm:col-span-full">{state.message}</p>
      ) : null}
      <Field label="Plate" htmlFor="plate" error={state.fieldErrors?.plate}>
        <Input id="plate" name="plate" required />
      </Field>
      <Field label="Type" htmlFor="type" error={state.fieldErrors?.type}>
        <select
          id="type"
          name="type"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue="MOTORCYCLE"
        >
          <option value="BICYCLE">Bicycle</option>
          <option value="MOTORCYCLE">Motorcycle</option>
          <option value="CAR">Car</option>
          <option value="VAN">Van</option>
          <option value="TRUCK">Truck</option>
        </select>
      </Field>
      <Field label="Fleet" htmlFor="fleetId">
        <select
          id="fleetId"
          name="fleetId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue=""
        >
          <option value="">Unassigned</option>
          {fleets.map((fleet) => (
            <option key={fleet.id} value={fleet.id}>
              {fleet.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Make" htmlFor="make">
        <Input id="make" name="make" />
      </Field>
      <Field label="Model" htmlFor="model">
        <Input id="model" name="model" />
      </Field>
      <Field label="Capacity (kg)" htmlFor="capacityKg" error={state.fieldErrors?.capacityKg}>
        <Input id="capacityKg" name="capacityKg" inputMode="decimal" />
      </Field>
      <Field label="Ownership" htmlFor="ownership">
        <select
          id="ownership"
          name="ownership"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue="OWNED"
        >
          <option value="OWNED">Owned</option>
          <option value="LEASED">Leased</option>
          <option value="RENTED">Rented</option>
        </select>
      </Field>
      <Field label="Insurance expires" htmlFor="insuranceExpiresAt">
        <Input id="insuranceExpiresAt" name="insuranceExpiresAt" type="date" />
      </Field>
      <Field label="Inspection expires" htmlFor="inspectionExpiresAt">
        <Input id="inspectionExpiresAt" name="inspectionExpiresAt" type="date" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving..." : "Add vehicle"}
        </Button>
      </div>
    </form>
  );
}

export function VehicleStatusForm({
  companyId,
  vehicle,
}: {
  companyId: string;
  vehicle: VehicleView;
}) {
  const [state, action, pending] = useActionState(updateVehicleStatusAction, initialFormState);
  const next =
    vehicle.status === "ACTIVE"
      ? "MAINTENANCE"
      : vehicle.status === "MAINTENANCE"
        ? "ACTIVE"
        : "RETIRED";
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      <input type="hidden" name="toStatus" value={next} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {next === "MAINTENANCE"
          ? "Send to maintenance"
          : next === "ACTIVE"
            ? "Return to service"
            : "Retire"}
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function DocumentForm({
  companyId,
  vehicles,
}: {
  companyId: string;
  vehicles: VehicleView[];
}) {
  const [state, action, pending] = useActionState(saveDocumentAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Vehicle" htmlFor="docVehicle">
        <select
          id="docVehicle"
          name="vehicleId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          required
        >
          <option value="">Select a vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Type" htmlFor="docType">
        <select
          id="docType"
          name="type"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue="REGISTRATION"
        >
          <option value="REGISTRATION">Registration</option>
          <option value="INSURANCE">Insurance</option>
          <option value="INSPECTION">Inspection</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>
      <Field label="Reference" htmlFor="docReference">
        <Input id="docReference" name="reference" />
      </Field>
      <Field label="Storage key" htmlFor="docKey" error={state.fieldErrors?.storageKey}>
        <Input id="docKey" name="storageKey" required />
      </Field>
      <Field label="Expires" htmlFor="docExpiry">
        <Input id="docExpiry" name="expiresAt" type="date" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Add document
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}

export function DocumentReviewForm({
  companyId,
  document,
}: {
  companyId: string;
  document: VehicleDocumentView;
}) {
  const [state, action, pending] = useActionState(reviewDocumentAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="documentId" value={document.id} />
      <select
        name="decision"
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        defaultValue="APPROVED"
      >
        <option value="APPROVED">Approve</option>
        <option value="REJECTED">Reject</option>
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Review
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function MaintenanceForm({
  companyId,
  vehicles,
}: {
  companyId: string;
  vehicles: VehicleView[];
}) {
  const [state, action, pending] = useActionState(saveMaintenanceAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Vehicle" htmlFor="maintVehicle">
        <select
          id="maintVehicle"
          name="vehicleId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          required
        >
          <option value="">Select a vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Performed at" htmlFor="maintDate">
        <Input id="maintDate" name="performedAt" type="datetime-local" required />
      </Field>
      <Field label="Cost" htmlFor="maintCost" error={state.fieldErrors?.cost}>
        <Input id="maintCost" name="cost" inputMode="decimal" required />
      </Field>
      <Field label="Currency" htmlFor="maintCurrency">
        <Input id="maintCurrency" name="currency" defaultValue="TZS" maxLength={3} />
      </Field>
      <Field label="Odometer (km)" htmlFor="maintOdo">
        <Input id="maintOdo" name="odometerKm" inputMode="numeric" />
      </Field>
      <Field label="Description" htmlFor="maintDescription">
        <Input id="maintDescription" name="description" required />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Record maintenance
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}
