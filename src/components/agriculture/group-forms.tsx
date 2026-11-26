"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  acceptHarvestAgreementAction,
  changeGroupMemberAction,
  createFarmerGroupAction,
  createHarvestAgreementAction,
  decideAgreementAction,
  recordHarvestDeliveryAction,
} from "@/features/agriculture/group-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function FarmerGroupForm() {
  const [state, action, pending] = useActionState(createFarmerGroupAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Group name" htmlFor="groupName" error={state.fieldErrors?.name}>
        <Input id="groupName" name="name" required />
      </Field>
      <Field label="Registration number" htmlFor="groupReg">
        <Input id="groupReg" name="registrationNumber" />
      </Field>
      <Field label="Region" htmlFor="groupRegion">
        <Input id="groupRegion" name="region" />
      </Field>
      <Field label="District" htmlFor="groupDistrict">
        <Input id="groupDistrict" name="district" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Create group
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function GroupMemberForm({
  groups,
  farmers,
}: {
  groups: { id: string; name: string }[];
  farmers: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(changeGroupMemberAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Select name="groupId" className="h-9 w-40" required>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </Select>
      <Select name="farmerId" className="h-9 w-40" required>
        {farmers.map((farmer) => (
          <option key={farmer.id} value={farmer.id}>
            {farmer.name}
          </option>
        ))}
      </Select>
      <Button type="submit" name="action" value="ADD" size="sm" variant="accent" disabled={pending}>
        Add
      </Button>
      <Button
        type="submit"
        name="action"
        value="REMOVE"
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        Remove
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function HarvestAgreementForm({
  farmers,
  groups,
}: {
  farmers: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createHarvestAgreementAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Farmer" htmlFor="agFarmer">
        <Select id="agFarmer" name="farmerId">
          <option value="">Group contract</option>
          {farmers.map((farmer) => (
            <option key={farmer.id} value={farmer.id}>
              {farmer.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Farmer group" htmlFor="agGroup">
        <Select id="agGroup" name="groupId">
          <option value="">Individual farmer</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Crop" htmlFor="agCrop" error={state.fieldErrors?.cropName}>
        <Input id="agCrop" name="cropName" required />
      </Field>
      <Field label="Variety" htmlFor="agVariety">
        <Input id="agVariety" name="variety" />
      </Field>
      <Field label="Expected quantity" htmlFor="agQty" error={state.fieldErrors?.expectedQuantity}>
        <Input id="agQty" name="expectedQuantity" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Unit" htmlFor="agUnit" error={state.fieldErrors?.unit}>
        <Select id="agUnit" name="unit" defaultValue="KG">
          <option value="KG">kg</option>
          <option value="BAG">bag</option>
          <option value="TONNE">tonne</option>
        </Select>
      </Field>
      <Field label="Price per unit" htmlFor="agPrice" error={state.fieldErrors?.pricePerUnit}>
        <Input id="agPrice" name="pricePerUnit" type="number" min="0" step="0.01" />
      </Field>
      <Field label="Pricing formula" htmlFor="agFormula">
        <Input id="agFormula" name="pricingFormula" placeholder="Optional if price is left blank" />
      </Field>
      <Field label="Currency" htmlFor="agCurrency" error={state.fieldErrors?.currency}>
        <Input id="agCurrency" name="currency" defaultValue="TZS" maxLength={3} required />
      </Field>
      <Field label="Delivery date" htmlFor="agDelivery" error={state.fieldErrors?.deliveryDate}>
        <Input id="agDelivery" name="deliveryDate" type="date" required />
      </Field>
      <Field
        label="Collection location"
        htmlFor="agLocation"
        error={state.fieldErrors?.collectionLocation}
      >
        <Input id="agLocation" name="collectionLocation" required />
      </Field>
      <Field label="Payment terms" htmlFor="agTerms" error={state.fieldErrors?.paymentTerms}>
        <Input id="agTerms" name="paymentTerms" required />
      </Field>
      <Field label="Quality specification" htmlFor="agQuality">
        <Input id="agQuality" name="qualitySpec" />
      </Field>
      <Field label="Variance policy" htmlFor="agVariance">
        <Input id="agVariance" name="variancePolicy" />
      </Field>
      <div className="flex items-end sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Send harvest agreement
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function AcceptAgreementForm({ agreementId }: { agreementId: string }) {
  const [state, action, pending] = useActionState(acceptHarvestAgreementAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="agreementId" value={agreementId} />
      <Input name="phone" placeholder="Buyer phone (optional)" className="h-9 w-40" />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Accept agreement
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function HarvestDeliveryForm({ agreementId }: { agreementId: string }) {
  const [state, action, pending] = useActionState(recordHarvestDeliveryAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="agreementId" value={agreementId} />
      <Input
        name="deliveredQuantity"
        type="number"
        min="0"
        step="0.01"
        placeholder="Delivered kg"
        className="h-9 w-32"
        required
      />
      <Input name="grade" placeholder="Grade" className="h-9 w-24" />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Record delivery
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function AgreementDecisionForm({
  agreementId,
  status,
}: {
  agreementId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(decideAgreementAction, initialFormState);
  if (!["ACCEPTED", "DELIVERED", "PENDING_FARMER"].includes(status)) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="agreementId" value={agreementId} />
      {status === "DELIVERED" ? (
        <Button
          type="submit"
          name="decision"
          value="COMPLETE"
          size="sm"
          variant="accent"
          disabled={pending}
        >
          Complete
        </Button>
      ) : null}
      <Input name="note" placeholder="Note" className="h-9 w-32" />
      <Button
        type="submit"
        name="decision"
        value="DISPUTE"
        size="sm"
        variant="secondary"
        disabled={pending}
      >
        Dispute
      </Button>
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
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
