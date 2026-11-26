"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  addCropActivityAction,
  createCropAction,
  recordFarmExpenseAction,
  recordHarvestAction,
  setCropStatusAction,
} from "@/features/agriculture/farm-actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function CropForm({
  farms,
  plots,
}: {
  farms: { id: string; name: string }[];
  plots: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createCropAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Farm" htmlFor="cropFarm" error={state.fieldErrors?.farmId}>
        <Select id="cropFarm" name="farmId" required>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Plot" htmlFor="cropPlot">
        <Select id="cropPlot" name="plotId">
          <option value="">No plot</option>
          {plots.map((plot) => (
            <option key={plot.id} value={plot.id}>
              {plot.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Crop" htmlFor="cropName" error={state.fieldErrors?.cropName}>
        <Input id="cropName" name="cropName" required />
      </Field>
      <Field label="Variety" htmlFor="cropVariety">
        <Input id="cropVariety" name="variety" />
      </Field>
      <Field label="Planted date" htmlFor="cropPlanted" error={state.fieldErrors?.plantedAt}>
        <Input id="cropPlanted" name="plantedAt" type="date" />
      </Field>
      <Field
        label="Expected harvest"
        htmlFor="cropExpected"
        error={state.fieldErrors?.expectedHarvestAt}
      >
        <Input id="cropExpected" name="expectedHarvestAt" type="date" />
      </Field>
      <Field
        label="Expected production"
        htmlFor="cropExpectedQty"
        error={state.fieldErrors?.expectedProduction}
      >
        <Input id="cropExpectedQty" name="expectedProduction" type="number" min="0" step="0.01" />
      </Field>
      <Field label="Note" htmlFor="cropNote">
        <Input id="cropNote" name="note" />
      </Field>
      <div className="flex items-end sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Create crop cycle
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ActivityForm({ crops }: { crops: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addCropActivityAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Crop" htmlFor="activityCrop" error={state.fieldErrors?.cropId}>
        <Select id="activityCrop" name="cropId" required>
          {crops.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Activity" htmlFor="activityType" error={state.fieldErrors?.type}>
        <Select id="activityType" name="type" defaultValue="FERTILIZING">
          <option value="PLANTING">Planting</option>
          <option value="FERTILIZING">Fertilizing</option>
          <option value="SPRAYING">Spraying</option>
          <option value="IRRIGATION">Irrigation</option>
          <option value="HARVEST">Harvest</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Date" htmlFor="activityDate" error={state.fieldErrors?.occurredAt}>
        <Input id="activityDate" name="occurredAt" type="date" required />
      </Field>
      <Field label="Note" htmlFor="activityNote">
        <Input id="activityNote" name="note" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Record activity
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ExpenseForm({ crops }: { crops: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(recordFarmExpenseAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Crop" htmlFor="expenseCrop">
        <Select id="expenseCrop" name="cropId">
          <option value="">Season-level expense</option>
          {crops.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Category" htmlFor="expenseCategory" error={state.fieldErrors?.category}>
        <Select id="expenseCategory" name="category" defaultValue="SEED">
          <option value="SEED">Seeds</option>
          <option value="FERTILIZER">Fertilizer</option>
          <option value="MANURE">Manure</option>
          <option value="LABOUR">Labour</option>
          <option value="TRANSPORT">Transport</option>
          <option value="IRRIGATION">Irrigation</option>
          <option value="PEST_CONTROL">Pest control</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Amount" htmlFor="expenseAmount" error={state.fieldErrors?.amount}>
        <Input id="expenseAmount" name="amount" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Currency" htmlFor="expenseCurrency" error={state.fieldErrors?.currency}>
        <Input id="expenseCurrency" name="currency" defaultValue="TZS" maxLength={3} required />
      </Field>
      <Field label="Date" htmlFor="expenseDate" error={state.fieldErrors?.occurredAt}>
        <Input id="expenseDate" name="occurredAt" type="date" required />
      </Field>
      <Field label="Note" htmlFor="expenseNote">
        <Input id="expenseNote" name="note" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Record expense
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function HarvestForm({ crops }: { crops: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(recordHarvestAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Crop" htmlFor="harvestCrop" error={state.fieldErrors?.cropId}>
        <Select id="harvestCrop" name="cropId" required>
          {crops.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Harvest date" htmlFor="harvestDate" error={state.fieldErrors?.harvestedAt}>
        <Input id="harvestDate" name="harvestedAt" type="date" required />
      </Field>
      <Field label="Quantity" htmlFor="harvestQty" error={state.fieldErrors?.quantity}>
        <Input id="harvestQty" name="quantity" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Unit" htmlFor="harvestUnit" error={state.fieldErrors?.unit}>
        <Select id="harvestUnit" name="unit" defaultValue="KG">
          <option value="KG">kg</option>
          <option value="BAG">bag</option>
          <option value="TONNE">tonne</option>
        </Select>
      </Field>
      <Field label="Grade" htmlFor="harvestGrade">
        <Input id="harvestGrade" name="grade" />
      </Field>
      <Field label="Storage" htmlFor="harvestStorage">
        <Input id="harvestStorage" name="storageLocation" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="accent" disabled={pending}>
          Record harvest
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function CropStatusForm({ cropId, status }: { cropId: string; status: string }) {
  const [state, action, pending] = useActionState(setCropStatusAction, initialFormState);
  const next =
    status === "PLANNED"
      ? "PLANTED"
      : status === "PLANTED" || status === "GROWING"
        ? "GROWING"
        : null;
  if (!next) return null;
  return (
    <form action={action}>
      <input type="hidden" name="cropId" value={cropId} />
      <input type="hidden" name="status" value={next} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Mark {next.toLowerCase()}
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
