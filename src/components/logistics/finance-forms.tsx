"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createEarningAction,
  createPayoutAction,
  createSettlementAction,
  recordExpenseAction,
  reconcileSettlementAction,
  saveCompensationAction,
  updateEarningStatusAction,
  updatePayoutStatusAction,
} from "@/features/logistics-finance/actions";
import type { DriverCompensationMode } from "@/generated/prisma/enums";
import { initialFormState } from "@/features/identity/form-state";

const compensationModes: DriverCompensationMode[] = [
  "FIXED_MONTHLY",
  "PER_DELIVERY",
  "PERCENTAGE",
  "DAILY",
  "HYBRID",
];

type DriverOption = {
  id: string;
  name: string;
  compensation: {
    mode: DriverCompensationMode;
    fixedAmount: string | null;
    perDelivery: string | null;
    rateBps: number | null;
    dailyAmount: string | null;
  } | null;
};

export function CompensationForm({
  companyId,
  drivers,
}: {
  companyId: string;
  drivers: DriverOption[];
}) {
  const [state, action, pending] = useActionState(saveCompensationAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Driver" htmlFor="compDriver">
        <select
          id="compDriver"
          name="membershipId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          required
        >
          <option value="">Select a driver</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Mode" htmlFor="compMode">
        <select
          id="compMode"
          name="mode"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue="PER_DELIVERY"
        >
          {compensationModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fixed amount" htmlFor="compFixed">
        <Input id="compFixed" name="fixedAmount" inputMode="decimal" />
      </Field>
      <Field label="Per delivery" htmlFor="compPer">
        <Input id="compPer" name="perDelivery" inputMode="decimal" />
      </Field>
      <Field label="Rate (bps)" htmlFor="compBps">
        <Input id="compBps" name="rateBps" inputMode="numeric" />
      </Field>
      <Field label="Daily amount" htmlFor="compDaily">
        <Input id="compDaily" name="dailyAmount" inputMode="decimal" />
      </Field>
      <Field label="Effective from" htmlFor="compFrom">
        <Input id="compFrom" name="effectiveFrom" type="date" required />
      </Field>
      <Field label="Currency" htmlFor="compCurrency">
        <Input id="compCurrency" name="currency" defaultValue="TZS" maxLength={3} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Save rule
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}

export function EarningForm({
  companyId,
  drivers,
}: {
  companyId: string;
  drivers: DriverOption[];
}) {
  const [state, action, pending] = useActionState(createEarningAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Driver" htmlFor="earnDriver">
        <select
          id="earnDriver"
          name="membershipId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          required
        >
          <option value="">Select a driver</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Basis" htmlFor="earnBasis">
        <Input id="earnBasis" name="basis" placeholder="e.g. 5 completed deliveries" required />
      </Field>
      <Field label="Amount" htmlFor="earnAmount">
        <Input id="earnAmount" name="amount" inputMode="decimal" required />
      </Field>
      <Field label="Currency" htmlFor="earnCurrency">
        <Input id="earnCurrency" name="currency" defaultValue="TZS" maxLength={3} />
      </Field>
      <Field label="Job ID (optional)" htmlFor="earnJob">
        <Input id="earnJob" name="jobId" placeholder="uuid" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Record earning
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}

export function EarningStatusForm({
  companyId,
  earningId,
}: {
  companyId: string;
  earningId: string;
}) {
  const [state, action, pending] = useActionState(updateEarningStatusAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="earningId" value={earningId} />
      <input type="hidden" name="toStatus" value="APPROVED" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Approve
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function PayoutForm({ companyId, drivers }: { companyId: string; drivers: DriverOption[] }) {
  const [state, action, pending] = useActionState(createPayoutAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Driver" htmlFor="payDriver">
        <select
          id="payDriver"
          name="membershipId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          required
        >
          <option value="">Select a driver</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount" htmlFor="payAmount">
        <Input id="payAmount" name="amount" inputMode="decimal" required />
      </Field>
      <Field label="Period start" htmlFor="payStart">
        <Input id="payStart" name="periodStart" type="date" required />
      </Field>
      <Field label="Period end" htmlFor="payEnd">
        <Input id="payEnd" name="periodEnd" type="date" required />
      </Field>
      <Field label="Currency" htmlFor="payCurrency">
        <Input id="payCurrency" name="currency" defaultValue="TZS" maxLength={3} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Create payout
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}

export function PayoutStatusForm({
  companyId,
  payoutId,
  status,
}: {
  companyId: string;
  payoutId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updatePayoutStatusAction, initialFormState);
  const next = status === "DRAFT" ? "APPROVED" : status === "APPROVED" ? "PAID" : null;
  if (!next) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="payoutId" value={payoutId} />
      <input type="hidden" name="toStatus" value={next} />
      <Input name="reference" placeholder="Payment reference" className="h-9 w-40" />
      <Input name="paymentProof" placeholder="Proof key" className="h-9 w-40" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {next === "APPROVED" ? "Approve" : "Mark paid"}
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function ExpenseForm({
  companyId,
  vehicles,
}: {
  companyId: string;
  vehicles: { id: string; plate: string }[];
}) {
  const [state, action, pending] = useActionState(recordExpenseAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Category" htmlFor="expenseCategory">
        <select
          id="expenseCategory"
          name="category"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue="FUEL"
        >
          {[
            "FUEL",
            "MAINTENANCE",
            "INSURANCE",
            "SALARY",
            "RENT",
            "UTILITIES",
            "PLATFORM_FEE",
            "OTHER",
          ].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Vehicle (optional)" htmlFor="expenseVehicle">
        <select
          id="expenseVehicle"
          name="vehicleId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue=""
        >
          <option value="">None</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount" htmlFor="expenseAmount">
        <Input id="expenseAmount" name="amount" inputMode="decimal" required />
      </Field>
      <Field label="Currency" htmlFor="expenseCurrency">
        <Input id="expenseCurrency" name="currency" defaultValue="TZS" maxLength={3} />
      </Field>
      <Field label="Occurred at" htmlFor="expenseDate">
        <Input id="expenseDate" name="occurredAt" type="datetime-local" required />
      </Field>
      <Field label="Reference" htmlFor="expenseReference">
        <Input id="expenseReference" name="reference" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Note" htmlFor="expenseNote">
          <Textarea id="expenseNote" name="note" />
        </Field>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Record expense
        </Button>
      </div>
      {state.message ? (
        <p className="text-xs text-muted-foreground sm:col-span-full">{state.message}</p>
      ) : null}
    </form>
  );
}

export function SettlementForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createSettlementAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Input name="periodStart" type="date" className="w-40" required />
      <Input name="periodEnd" type="date" className="w-40" required />
      <Button type="submit" variant="accent" disabled={pending}>
        Generate settlement
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function ReconcileSettlementForm({
  companyId,
  settlementId,
}: {
  companyId: string;
  settlementId: string;
}) {
  const [state, action, pending] = useActionState(reconcileSettlementAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="settlementId" value={settlementId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Reconcile
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}
