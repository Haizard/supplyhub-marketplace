"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  decideBookingAction,
  purchaseInputAction,
  quoteBookingAction,
  registerSupplierAction,
  requestBookingAction,
  saveInputAction,
  saveServiceAction,
  verifySupplierAction,
} from "@/features/agriculture/supplier-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function SupplierProfileForm() {
  const [state, action, pending] = useActionState(registerSupplierAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Business name" htmlFor="supplierName" error={state.fieldErrors?.businessName}>
        <Input id="supplierName" name="businessName" required />
      </Field>
      <Field label="Type" htmlFor="supplierType" error={state.fieldErrors?.type}>
        <Select id="supplierType" name="type" defaultValue="BOTH">
          <option value="INPUT">Inputs</option>
          <option value="SERVICE">Services</option>
          <option value="BOTH">Both</option>
        </Select>
      </Field>
      <Field label="Registration number" htmlFor="supplierReg">
        <Input id="supplierReg" name="registrationNumber" />
      </Field>
      <Field label="Licence reference" htmlFor="supplierLicense">
        <Input id="supplierLicense" name="licenseReference" />
      </Field>
      <Field label="Insurance reference" htmlFor="supplierInsurance">
        <Input id="supplierInsurance" name="insuranceReference" />
      </Field>
      <Field label="Phone" htmlFor="supplierPhone">
        <Input id="supplierPhone" name="phone" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          Save supplier profile
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function InputForm() {
  const [state, action, pending] = useActionState(saveInputAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Input name" htmlFor="inputName" error={state.fieldErrors?.name}>
        <Input id="inputName" name="name" required />
      </Field>
      <Field label="Category" htmlFor="inputCategory" error={state.fieldErrors?.category}>
        <Select id="inputCategory" name="category" defaultValue="MANURE_COMPOST">
          <option value="SEED">Seeds</option>
          <option value="FERTILIZER">Fertilizer</option>
          <option value="MANURE_COMPOST">Manure / compost</option>
          <option value="CROP_PROTECTION">Crop protection</option>
          <option value="ANIMAL_FEED">Animal feed</option>
          <option value="VETERINARY">Veterinary</option>
          <option value="TOOL">Tools</option>
          <option value="IRRIGATION">Irrigation</option>
          <option value="EQUIPMENT">Equipment</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Quantity" htmlFor="inputQty" error={state.fieldErrors?.quantity}>
        <Input id="inputQty" name="quantity" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Unit" htmlFor="inputUnit" error={state.fieldErrors?.unit}>
        <Select id="inputUnit" name="unit" defaultValue="KG">
          <option value="KG">kg</option>
          <option value="BAG">bag</option>
          <option value="TONNE">tonne</option>
          <option value="CRATE">crate</option>
          <option value="LITRE">litre</option>
          <option value="PIECE">piece</option>
        </Select>
      </Field>
      <Field label="Price per unit" htmlFor="inputPrice" error={state.fieldErrors?.pricePerUnit}>
        <Input id="inputPrice" name="pricePerUnit" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Currency" htmlFor="inputCurrency" error={state.fieldErrors?.currency}>
        <Input id="inputCurrency" name="currency" defaultValue="TZS" maxLength={3} required />
      </Field>
      <Field label="Minimum order" htmlFor="inputMin" error={state.fieldErrors?.minimumOrder}>
        <Input id="inputMin" name="minimumOrder" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Treatment / composting status" htmlFor="inputTreatment">
        <Input id="inputTreatment" name="treatmentStatus" placeholder="e.g. composted 6 months" />
      </Field>
      <Field
        label="Registration / licence reference"
        htmlFor="inputReg"
        error={state.fieldErrors?.registrationRef}
      >
        <Input id="inputReg" name="registrationRef" />
      </Field>
      <Field label="Safety notes" htmlFor="inputSafety">
        <Input id="inputSafety" name="safetyNotes" />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="organicClaim" value="true" className="size-4" /> Organic claim
        (unverified)
      </label>
      <div className="flex items-end sm:col-span-full">
        <Button type="submit" variant="secondary" disabled={pending}>
          Publish input
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ServiceForm() {
  const [state, action, pending] = useActionState(saveServiceAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Service" htmlFor="serviceType" error={state.fieldErrors?.serviceType}>
        <Select id="serviceType" name="serviceType" defaultValue="TRACTOR">
          <option value="TRACTOR">Tractor hire</option>
          <option value="PLOUGHING">Ploughing</option>
          <option value="PLANTING">Planting</option>
          <option value="SPRAYING">Spraying</option>
          <option value="HARVESTING">Harvesting</option>
          <option value="IRRIGATION">Irrigation</option>
          <option value="SOIL_TESTING">Soil testing</option>
          <option value="AGRONOMY">Agronomy</option>
          <option value="TRANSPORT">Transport</option>
          <option value="STORAGE">Storage</option>
          <option value="LABOUR">Farm labour</option>
        </Select>
      </Field>
      <Field label="Title" htmlFor="serviceTitle" error={state.fieldErrors?.title}>
        <Input id="serviceTitle" name="title" required />
      </Field>
      <Field label="Rate" htmlFor="serviceRate" error={state.fieldErrors?.rateAmount}>
        <Input id="serviceRate" name="rateAmount" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Rate unit" htmlFor="serviceRateUnit" error={state.fieldErrors?.rateUnit}>
        <Input id="serviceRateUnit" name="rateUnit" defaultValue="per acre" required />
      </Field>
      <Field label="Currency" htmlFor="serviceCurrency" error={state.fieldErrors?.currency}>
        <Input id="serviceCurrency" name="currency" defaultValue="TZS" maxLength={3} required />
      </Field>
      <Field label="Service area" htmlFor="serviceArea">
        <Input id="serviceArea" name="serviceArea" />
      </Field>
      <Field
        label="Qualification reference"
        htmlFor="serviceQual"
        error={state.fieldErrors?.qualificationRef}
      >
        <Input id="serviceQual" name="qualificationRef" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Publish service
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function VerifySupplierForm({ supplierId }: { supplierId: string }) {
  const [state, action, pending] = useActionState(verifySupplierAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="supplierId" value={supplierId} />
      <Button
        type="submit"
        name="decision"
        value="VERIFY"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Verify
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

export function BookingRequestForm({ services }: { services: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(requestBookingAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Service" htmlFor="bookingService" error={state.fieldErrors?.serviceId}>
        <Select id="bookingService" name="serviceId" required>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Requested date" htmlFor="bookingDate" error={state.fieldErrors?.requestedFor}>
        <Input id="bookingDate" name="requestedFor" type="date" required />
      </Field>
      <Field label="Note" htmlFor="bookingNote">
        <Input id="bookingNote" name="note" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          Request booking
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function BookingQuoteForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(quoteBookingAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Input
        name="quoteAmount"
        type="number"
        min="0"
        step="0.01"
        placeholder="Quote"
        className="h-9 w-28"
        required
      />
      <Input name="scheduledAt" type="date" className="h-9 w-40" required />
      <Input name="note" placeholder="Note" className="h-9 w-36" />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Send quote
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function BookingDecisionForm({ bookingId, status }: { bookingId: string; status: string }) {
  const [state, action, pending] = useActionState(decideBookingAction, initialFormState);
  const next =
    status === "REQUESTED"
      ? null
      : status === "QUOTED"
        ? "CONFIRM"
        : status === "CONFIRMED"
          ? "START"
          : status === "IN_PROGRESS"
            ? "COMPLETE"
            : null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {next ? (
        <Button
          type="submit"
          name="decision"
          value={next}
          size="sm"
          variant="accent"
          disabled={pending}
        >
          {next.charAt(0) + next.slice(1).toLowerCase()}
        </Button>
      ) : null}
      {["REQUESTED", "QUOTED", "CONFIRMED", "IN_PROGRESS"].includes(status) ? (
        <>
          <Input name="reason" placeholder="Reason (optional)" className="h-9 w-36" />
          <Button
            type="submit"
            name="decision"
            value="CANCEL"
            size="sm"
            variant="ghost"
            disabled={pending}
          >
            Cancel
          </Button>
        </>
      ) : null}
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function InputPurchaseForm({ inputId }: { inputId: string }) {
  const [state, action, pending] = useActionState(purchaseInputAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="inputId" value={inputId} />
      <Input
        name="quantity"
        type="number"
        min="0"
        step="0.01"
        placeholder="Quantity"
        className="h-9 w-28"
        required
      />
      <Input name="phone" placeholder="Phone for payment" className="h-9 w-36" />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Buy input
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
