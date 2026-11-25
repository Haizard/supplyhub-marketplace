"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  changeShareStatusAction,
  recordHubIntakeAction,
  releaseHubParcelAction,
  releaseShareUsageAction,
  reserveSharedVehicleAction,
  respondShareOfferAction,
  saveParcelHubAction,
  setShareVehicleAction,
  createShareOfferAction,
} from "@/features/logistics-sharing/actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return (
    <p className={error ? "text-xs text-danger" : "text-xs break-all text-success"}>{message}</p>
  );
}

export function ShareOfferForm({
  companyId,
  vehicles,
}: {
  companyId: string;
  vehicles: { id: string; plate: string }[];
}) {
  const [state, action, pending] = useActionState(createShareOfferAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field
        label="Partner company code"
        htmlFor="partnerCode"
        error={state.fieldErrors?.partnerCompanyCode}
      >
        <Input id="partnerCode" name="partnerCompanyCode" placeholder="LC-..." required />
      </Field>
      <Field label="Agreement type" htmlFor="shareType" error={state.fieldErrors?.type}>
        <Select id="shareType" name="type" defaultValue="VEHICLE_LENDING">
          <option value="VEHICLE_LENDING">Vehicle lending</option>
          <option value="SUBCONTRACT_DELIVERY">Delivery subcontracting</option>
        </Select>
      </Field>
      <Field
        label="Accountable company"
        htmlFor="accountable"
        error={state.fieldErrors?.accountable}
      >
        <Select id="accountable" name="accountable" defaultValue="PARTNER">
          <option value="PARTNER">Partner (using company)</option>
          <option value="OWNER">Owner (capacity provider)</option>
        </Select>
      </Field>
      <Field
        label="Insurance policy reference"
        htmlFor="policyRef"
        error={state.fieldErrors?.insurancePolicyRef}
      >
        <Input id="policyRef" name="insurancePolicyRef" required />
      </Field>
      <Field
        label="Insurance expires"
        htmlFor="insuranceExpiry"
        error={state.fieldErrors?.insuranceExpiresAt}
      >
        <Input id="insuranceExpiry" name="insuranceExpiresAt" type="date" required />
      </Field>
      <Field
        label="Effective from"
        htmlFor="effectiveFrom"
        error={state.fieldErrors?.effectiveFrom}
      >
        <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
      </Field>
      <Field
        label="Effective to (optional)"
        htmlFor="effectiveTo"
        error={state.fieldErrors?.effectiveTo}
      >
        <Input id="effectiveTo" name="effectiveTo" type="date" />
      </Field>
      <Field
        label="Rate amount (optional)"
        htmlFor="rateAmount"
        error={state.fieldErrors?.rateAmount}
      >
        <Input id="rateAmount" name="rateAmount" type="number" min="0" step="0.01" />
      </Field>
      <Field
        label="Currency (optional)"
        htmlFor="rateCurrency"
        error={state.fieldErrors?.rateCurrency}
      >
        <Input id="rateCurrency" name="rateCurrency" placeholder="TZS" maxLength={3} />
      </Field>
      <fieldset className="space-y-1 sm:col-span-full">
        <legend className="text-sm font-medium">Vehicles to share</legend>
        <div className="flex flex-wrap gap-4">
          {vehicles.map((vehicle) => (
            <label key={vehicle.id} className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="vehicleIds" value={vehicle.id} className="size-4" />
              <span className="font-mono">{vehicle.plate}</span>
            </label>
          ))}
          {vehicles.length === 0 ? (
            <span className="text-xs text-muted-foreground">Add an active vehicle first.</span>
          ) : null}
        </div>
        {state.fieldErrors?.vehicleIds ? (
          <p className="text-xs text-danger">{state.fieldErrors.vehicleIds}</p>
        ) : null}
      </fieldset>
      <Field
        label="Liability terms (optional)"
        htmlFor="liabilityTerms"
        error={state.fieldErrors?.liabilityTerms}
      >
        <Input id="liabilityTerms" name="liabilityTerms" className="sm:col-span-2" />
      </Field>
      <div className="sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Send sharing offer
        </Button>
        <Feedback message={state.message} error={state.status === "error"} />
      </div>
    </form>
  );
}

export function ShareResponseForm({
  companyId,
  agreementId,
}: {
  companyId: string;
  agreementId: string;
}) {
  const [state, action, pending] = useActionState(respondShareOfferAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <Button
        type="submit"
        name="decision"
        value="ACCEPT"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Accept &amp; activate
      </Button>
      <Button
        type="submit"
        name="decision"
        value="DECLINE"
        size="sm"
        variant="secondary"
        disabled={pending}
      >
        Decline
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ShareStatusForm({
  companyId,
  agreementId,
  status,
}: {
  companyId: string;
  agreementId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(changeShareStatusAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      {status === "ACTIVE" ? (
        <Button
          type="submit"
          name="action"
          value="SUSPEND"
          size="sm"
          variant="secondary"
          disabled={pending}
        >
          Suspend
        </Button>
      ) : null}
      {status === "SUSPENDED" ? (
        <Button
          type="submit"
          name="action"
          value="RESUME"
          size="sm"
          variant="secondary"
          disabled={pending}
        >
          Resume
        </Button>
      ) : null}
      {status !== "TERMINATED" && status !== "DECLINED" ? (
        <>
          <Input name="reason" placeholder="Reason (optional)" className="h-9 w-40" />
          <Button
            type="submit"
            name="action"
            value="TERMINATE"
            size="sm"
            variant="ghost"
            disabled={pending}
          >
            Terminate
          </Button>
        </>
      ) : null}
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function SetShareVehicleForm({
  companyId,
  agreementId,
  vehicles,
  active,
}: {
  companyId: string;
  agreementId: string;
  vehicles: { id: string; plate: string }[];
  active: boolean;
}) {
  const [state, action, pending] = useActionState(setShareVehicleAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="active" value={active ? "true" : "false"} />
      <Select name="vehicleId" required className="h-9 w-40">
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.plate}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {active ? "Add" : "Withdraw"}
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ReserveUsageForm({
  companyId,
  agreementId,
  vehicles,
  jobs,
}: {
  companyId: string;
  agreementId: string;
  vehicles: { id: string; plate: string }[];
  jobs: { id: string; jobNumber: string }[];
}) {
  const [state, action, pending] = useActionState(reserveSharedVehicleAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="agreementId" value={agreementId} />
      <Select name="vehicleId" required className="h-9 w-40">
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.plate}
          </option>
        ))}
      </Select>
      <Select name="jobId" className="h-9 w-48">
        <option value="">No linked job</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.jobNumber}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Reserve
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ReleaseUsageForm({ companyId, usageId }: { companyId: string; usageId: string }) {
  const [state, action, pending] = useActionState(releaseShareUsageAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="usageId" value={usageId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Release
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ParcelHubForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(saveParcelHubAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Hub code" htmlFor="hubCode" error={state.fieldErrors?.hubCode}>
        <Input id="hubCode" name="hubCode" placeholder="DAR-01" required />
      </Field>
      <Field label="Name" htmlFor="hubName" error={state.fieldErrors?.name}>
        <Input id="hubName" name="name" required />
      </Field>
      <Field label="Address" htmlFor="hubAddress" error={state.fieldErrors?.address}>
        <Input id="hubAddress" name="address" required />
      </Field>
      <Field label="City" htmlFor="hubCity" error={state.fieldErrors?.city}>
        <Input id="hubCity" name="city" />
      </Field>
      <Field label="Capacity (parcels)" htmlFor="hubCapacity" error={state.fieldErrors?.capacity}>
        <Input id="hubCapacity" name="capacity" type="number" min="1" defaultValue={50} required />
      </Field>
      <Field label="Latitude" htmlFor="hubLat" error={state.fieldErrors?.latitude}>
        <Input id="hubLat" name="latitude" type="number" step="0.0000001" />
      </Field>
      <Field label="Longitude" htmlFor="hubLng" error={state.fieldErrors?.longitude}>
        <Input id="hubLng" name="longitude" type="number" step="0.0000001" />
      </Field>
      <div className="sm:col-span-full">
        <Button type="submit" variant="secondary" disabled={pending}>
          Save hub
        </Button>
        <Feedback message={state.message} error={state.status === "error"} />
      </div>
    </form>
  );
}

export function ParcelIntakeForm({
  companyId,
  hubs,
  jobs,
}: {
  companyId: string;
  hubs: { id: string; name: string; storedCount: number; capacity: number }[];
  jobs: { id: string; jobNumber: string }[];
}) {
  const [state, action, pending] = useActionState(recordHubIntakeAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Hub" htmlFor="intakeHub" error={state.fieldErrors?.hubId}>
        <Select id="intakeHub" name="hubId" required>
          {hubs.map((hub) => (
            <option key={hub.id} value={hub.id}>
              {hub.name} ({hub.storedCount}/{hub.capacity})
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Tracking reference"
        htmlFor="trackingRef"
        error={state.fieldErrors?.trackingRef}
      >
        <Input id="trackingRef" name="trackingRef" required />
      </Field>
      <Field label="Direction" htmlFor="intakeDirection" error={state.fieldErrors?.direction}>
        <Select id="intakeDirection" name="direction" defaultValue="INTAKE">
          <option value="INTAKE">Customer drops at hub</option>
          <option value="COLLECTION">Courier collects from hub</option>
        </Select>
      </Field>
      <Field label="Linked job (optional)" htmlFor="intakeJob" error={state.fieldErrors?.jobId}>
        <Select id="intakeJob" name="jobId">
          <option value="">No linked job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.jobNumber}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes (optional)" htmlFor="intakeNotes" error={state.fieldErrors?.notes}>
        <Input id="intakeNotes" name="notes" />
      </Field>
      <div className="sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Record intake
        </Button>
        <Feedback message={state.message} error={state.status === "error"} />
      </div>
    </form>
  );
}

export function ParcelReleaseForm({
  companyId,
  handoverId,
}: {
  companyId: string;
  handoverId: string;
}) {
  const [state, action, pending] = useActionState(releaseHubParcelAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="handoverId" value={handoverId} />
      <Input
        name="pickupCode"
        placeholder="6-digit code"
        maxLength={6}
        className="h-9 w-32"
        required
      />
      <Input name="releasedToName" placeholder="Recipient name" className="h-9 w-40" required />
      <Input name="releasedToPhone" placeholder="Phone (optional)" className="h-9 w-36" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Release
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
