"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  bookStorageAction,
  decideIntakeAction,
  decideStorageAction,
  recordIntakeAction,
  registerCentreAction,
  registerStorageFacilityAction,
  requestAgriculturalDeliveryAction,
} from "@/features/agriculture/logistics-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function CentreForm() {
  const [state, action, pending] = useActionState(registerCentreAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Centre name" htmlFor="centreName" error={state.fieldErrors?.name}>
        <Input id="centreName" name="name" required />
      </Field>
      <Field label="Location" htmlFor="centreLocation" error={state.fieldErrors?.location}>
        <Input id="centreLocation" name="location" required />
      </Field>
      <Field label="Capacity (kg)" htmlFor="centreCapacity" error={state.fieldErrors?.capacityKg}>
        <Input id="centreCapacity" name="capacityKg" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Services" htmlFor="centreServices">
        <Input id="centreServices" name="services" placeholder="Weighing, grading, storage" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Register centre
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function StorageFacilityForm() {
  const [state, action, pending] = useActionState(registerStorageFacilityAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Facility name" htmlFor="facilityName" error={state.fieldErrors?.name}>
        <Input id="facilityName" name="name" required />
      </Field>
      <Field label="Location" htmlFor="facilityLocation" error={state.fieldErrors?.location}>
        <Input id="facilityLocation" name="location" required />
      </Field>
      <Field label="Capacity (kg)" htmlFor="facilityCapacity" error={state.fieldErrors?.capacityKg}>
        <Input id="facilityCapacity" name="capacityKg" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Rate" htmlFor="facilityRate" error={state.fieldErrors?.rateAmount}>
        <Input id="facilityRate" name="rateAmount" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Rate unit" htmlFor="facilityRateUnit" error={state.fieldErrors?.rateUnit}>
        <Input id="facilityRateUnit" name="rateUnit" defaultValue="per day" required />
      </Field>
      <Field label="Currency" htmlFor="facilityCurrency" error={state.fieldErrors?.currency}>
        <Input id="facilityCurrency" name="currency" defaultValue="TZS" maxLength={3} required />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="coldChain" value="true" className="size-4" /> Cold chain
      </label>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Register facility
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function AgriculturalDeliveryForm({
  companies,
  centres,
  facilities,
}: {
  companies: { id: string; name: string }[];
  centres: { id: string; name: string }[];
  facilities: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    requestAgriculturalDeliveryAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Logistics company"
        htmlFor="deliveryCompany"
        error={state.fieldErrors?.companyId}
      >
        <Select id="deliveryCompany" name="companyId" required>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Cargo" htmlFor="deliveryCargo" error={state.fieldErrors?.cargoType}>
        <Select id="deliveryCargo" name="cargoType" defaultValue="PRODUCE">
          <option value="PRODUCE">Produce</option>
          <option value="INPUT">Inputs</option>
          <option value="MANURE">Manure</option>
        </Select>
      </Field>
      <Field label="Direction" htmlFor="deliveryDirection" error={state.fieldErrors?.direction}>
        <Select id="deliveryDirection" name="direction" defaultValue="FARM_TO_BUYER">
          <option value="FARM_TO_BUYER">Farm → buyer</option>
          <option value="FARM_TO_CENTRE">Farm → collection centre</option>
          <option value="CENTRE_TO_BUYER">Centre → buyer</option>
          <option value="INPUT_TO_FARM">Inputs → farm</option>
        </Select>
      </Field>
      <Field label="Quantity" htmlFor="deliveryQty" error={state.fieldErrors?.quantity}>
        <Input id="deliveryQty" name="quantity" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Unit" htmlFor="deliveryUnit" error={state.fieldErrors?.unit}>
        <Select id="deliveryUnit" name="unit" defaultValue="KG">
          <option value="KG">kg</option>
          <option value="BAG">bag</option>
          <option value="TONNE">tonne</option>
        </Select>
      </Field>
      <Field label="Collection centre" htmlFor="deliveryCentre">
        <Select id="deliveryCentre" name="centreId">
          <option value="">None</option>
          {centres.map((centre) => (
            <option key={centre.id} value={centre.id}>
              {centre.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Storage facility" htmlFor="deliveryFacility">
        <Select id="deliveryFacility" name="facilityId">
          <option value="">None</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Pickup name" htmlFor="pickupName" error={state.fieldErrors?.pickupName}>
        <Input id="pickupName" name="pickupName" required />
      </Field>
      <Field
        label="Pickup address"
        htmlFor="pickupAddress"
        error={state.fieldErrors?.pickupAddress}
      >
        <Input id="pickupAddress" name="pickupAddress" required />
      </Field>
      <Field label="Pickup latitude" htmlFor="pickupLat" error={state.fieldErrors?.pickup}>
        <Input id="pickupLat" name="pickupLatitude" type="number" step="0.0000001" required />
      </Field>
      <Field label="Pickup longitude" htmlFor="pickupLng">
        <Input id="pickupLng" name="pickupLongitude" type="number" step="0.0000001" required />
      </Field>
      <Field label="Dropoff name" htmlFor="dropoffName" error={state.fieldErrors?.dropoffName}>
        <Input id="dropoffName" name="dropoffName" required />
      </Field>
      <Field
        label="Dropoff address"
        htmlFor="dropoffAddress"
        error={state.fieldErrors?.dropoffAddress}
      >
        <Input id="dropoffAddress" name="dropoffAddress" required />
      </Field>
      <Field label="Dropoff latitude" htmlFor="dropoffLat">
        <Input id="dropoffLat" name="dropoffLatitude" type="number" step="0.0000001" required />
      </Field>
      <Field label="Dropoff longitude" htmlFor="dropoffLng">
        <Input id="dropoffLng" name="dropoffLongitude" type="number" step="0.0000001" required />
      </Field>
      <div className="flex items-end sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Request farm collection
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function IntakeForm({ centres }: { centres: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(recordIntakeAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Collection centre" htmlFor="intakeCentre" error={state.fieldErrors?.centreId}>
        <Select id="intakeCentre" name="centreId" required>
          {centres.map((centre) => (
            <option key={centre.id} value={centre.id}>
              {centre.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Weighed (kg)" htmlFor="intakeWeighed" error={state.fieldErrors?.weighedKg}>
        <Input id="intakeWeighed" name="weighedKg" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Rejected (kg)" htmlFor="intakeRejected" error={state.fieldErrors?.rejectedKg}>
        <Input
          id="intakeRejected"
          name="rejectedKg"
          type="number"
          min="0"
          step="0.01"
          defaultValue={0}
          required
        />
      </Field>
      <Field label="Grade" htmlFor="intakeGrade">
        <Input id="intakeGrade" name="grade" />
      </Field>
      <Field label="Moisture %" htmlFor="intakeMoisture" error={state.fieldErrors?.moisturePercent}>
        <Input
          id="intakeMoisture"
          name="moisturePercent"
          type="number"
          min="0"
          max="100"
          step="0.01"
        />
      </Field>
      <Field label="Evidence note" htmlFor="intakeEvidence">
        <Input id="intakeEvidence" name="evidenceNote" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="accent" disabled={pending}>
          Record intake
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function IntakeDecisionForm({ intakeId, status }: { intakeId: string; status: string }) {
  const [state, action, pending] = useActionState(decideIntakeAction, initialFormState);
  if (!["RECEIVED", "GRADED"].includes(status)) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="intakeId" value={intakeId} />
      <Input name="note" placeholder="Decision note" className="h-9 w-36" />
      <Button
        type="submit"
        name="decision"
        value="ACCEPT"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Accept
      </Button>
      <Button
        type="submit"
        name="decision"
        value="REJECT"
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        Reject
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function StorageBookingForm({ facilities }: { facilities: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(bookStorageAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Select name="facilityId" className="h-9 w-48" required>
        {facilities.map((facility) => (
          <option key={facility.id} value={facility.id}>
            {facility.name}
          </option>
        ))}
      </Select>
      <Input
        name="quantityKg"
        type="number"
        min="0"
        step="0.01"
        placeholder="Kg"
        className="h-9 w-28"
        required
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Hold storage
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function StorageDecisionForm({ bookingId, status }: { bookingId: string; status: string }) {
  const [state, action, pending] = useActionState(decideStorageAction, initialFormState);
  if (!["HELD", "STORED"].includes(status)) return null;
  return (
    <form action={action}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <Button
        type="submit"
        name="decision"
        value={status === "HELD" ? "STORE" : "RELEASE"}
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        {status === "HELD" ? "Mark stored" : "Release"}
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
