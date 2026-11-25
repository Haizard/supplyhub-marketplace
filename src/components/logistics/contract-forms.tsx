"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ClientView } from "@/features/logistics-clients/queries";
import {
  createInvoiceAction,
  recordContractDeliveryAction,
  saveContractAction,
  updateContractStatusAction,
  updateInvoiceStatusAction,
} from "@/features/logistics-contracts/actions";
import type { ContractDetailView, ContractView } from "@/features/logistics-contracts/queries";
import { initialFormState } from "@/features/identity/form-state";

export function ContractForm({
  companyId,
  clients,
  contract,
}: {
  companyId: string;
  clients: ClientView[];
  contract?: ContractDetailView;
}) {
  const [state, action, pending] = useActionState(saveContractAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const defaultClientId = contract?.clientId ?? clients[0]?.id ?? "";

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="contractId" value={contract?.id ?? ""} />

      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger sm:col-span-full">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success sm:col-span-full">{state.message}</p>
      ) : null}

      <Field label="Client" htmlFor="contractClient" error={errors.clientId}>
        <select
          id="contractClient"
          name="clientId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue={defaultClientId}
          required
        >
          <option value="">Select a client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title" htmlFor="contractTitle" error={errors.title}>
        <Input id="contractTitle" name="title" defaultValue={contract?.title ?? ""} required />
      </Field>
      <Field label="Type" htmlFor="contractType">
        <select
          id="contractType"
          name="type"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue={contract?.type ?? "MONTHLY"}
        >
          <option value="PER_DELIVERY">Per delivery</option>
          <option value="MONTHLY">Monthly</option>
          <option value="VOLUME">Volume</option>
          <option value="DEDICATED_FLEET">Dedicated fleet</option>
          <option value="GEOGRAPHIC">Geographic</option>
          <option value="HYBRID">Hybrid</option>
        </select>
      </Field>
      <Field label="Currency" htmlFor="contractCurrency">
        <Input
          id="contractCurrency"
          name="currency"
          defaultValue={contract?.currency ?? "TZS"}
          maxLength={3}
        />
      </Field>
      <Field label="Starts" htmlFor="contractStart" error={errors.startsAt}>
        <Input
          id="contractStart"
          name="startsAt"
          type="date"
          defaultValue={contract?.startsAt.slice(0, 10)}
          required
        />
      </Field>
      <Field label="Ends" htmlFor="contractEnd" error={errors.endsAt}>
        <Input
          id="contractEnd"
          name="endsAt"
          type="date"
          defaultValue={contract?.endsAt?.slice(0, 10)}
        />
      </Field>
      <Field
        label="Monthly allocation"
        htmlFor="contractAllocation"
        error={errors.monthlyAllocation}
      >
        <Input
          id="contractAllocation"
          name="monthlyAllocation"
          type="number"
          min={1}
          defaultValue={contract?.monthlyAllocation ?? ""}
        />
      </Field>
      <Field label="Coverage area" htmlFor="contractArea">
        <Input id="contractArea" name="coverageArea" defaultValue={contract?.coverageArea ?? ""} />
      </Field>
      <Field label="Service hours" htmlFor="contractHours">
        <Input id="contractHours" name="serviceHours" defaultValue={contract?.serviceHours ?? ""} />
      </Field>
      <Field label="Payment terms" htmlFor="contractTerms">
        <Input id="contractTerms" name="paymentTerms" defaultValue={contract?.paymentTerms ?? ""} />
      </Field>

      <fieldset className="col-span-full grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="text-sm font-medium">Pricing</legend>
        <Field label="Mode" htmlFor="pricingMode">
          <select
            id="pricingMode"
            name="mode"
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
            defaultValue={contract?.pricing?.mode ?? "PER_DELIVERY"}
          >
            <option value="PER_DELIVERY">Per delivery</option>
            <option value="FLAT_MONTHLY">Flat monthly</option>
            <option value="TIERED_VOLUME">Tiered volume</option>
            <option value="PER_KM">Per km</option>
          </select>
        </Field>
        <Field label="Per delivery" htmlFor="perDelivery">
          <Input
            id="perDelivery"
            name="perDelivery"
            inputMode="decimal"
            defaultValue={contract?.pricing?.perDelivery ?? ""}
          />
        </Field>
        <Field label="Monthly fee" htmlFor="monthlyFee">
          <Input
            id="monthlyFee"
            name="monthlyFee"
            inputMode="decimal"
            defaultValue={contract?.pricing?.monthlyFee ?? ""}
          />
        </Field>
        <Field label="Per km" htmlFor="perKmRate">
          <Input
            id="perKmRate"
            name="perKmRate"
            inputMode="decimal"
            defaultValue={contract?.pricing?.perKmRate ?? ""}
          />
        </Field>
        <Field label="Minimum fee" htmlFor="minimumFee">
          <Input
            id="minimumFee"
            name="minimumFee"
            inputMode="decimal"
            defaultValue={contract?.pricing?.minimumFee ?? ""}
          />
        </Field>
        <Field label="Included units" htmlFor="includedUnits">
          <Input
            id="includedUnits"
            name="includedUnits"
            type="number"
            min={0}
            defaultValue={contract?.pricing?.includedUnits ?? ""}
          />
        </Field>
      </fieldset>

      <fieldset className="col-span-full grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="text-sm font-medium">Service level</legend>
        <Field label="Max delivery hours" htmlFor="maxHours">
          <Input
            id="maxHours"
            name="maxDeliveryHours"
            type="number"
            min={1}
            defaultValue={contract?.sla?.maxDeliveryHours ?? ""}
          />
        </Field>
        <Field label="Minimum completion (bps)" htmlFor="minBps">
          <Input
            id="minBps"
            name="minCompletionRateBps"
            type="number"
            min={0}
            max={10000}
            defaultValue={contract?.sla?.minCompletionRateBps ?? ""}
          />
        </Field>
        <Field label="Claims window (days)" htmlFor="claimsDays">
          <Input
            id="claimsDays"
            name="claimsWindowDays"
            type="number"
            min={1}
            defaultValue={contract?.sla?.claimsWindowDays ?? ""}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="proofRequired"
            defaultChecked={contract?.sla?.proofRequired ?? true}
            className="size-4"
          />{" "}
          Proof required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="otpRequired"
            defaultChecked={contract?.sla?.otpRequired ?? true}
            className="size-4"
          />{" "}
          OTP required
        </label>
      </fieldset>

      <div className="col-span-full">
        <Field label="Description" htmlFor="contractDescription">
          <Textarea
            id="contractDescription"
            name="description"
            defaultValue={contract?.description ?? ""}
          />
        </Field>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving..." : contract ? "Save contract" : "Create contract"}
        </Button>
      </div>
    </form>
  );
}

export function ContractStatusForm({
  companyId,
  contract,
}: {
  companyId: string;
  contract: ContractView;
}) {
  const [state, action, pending] = useActionState(updateContractStatusAction, initialFormState);
  const options =
    contract.status === "DRAFT"
      ? ["PROPOSED", "ACTIVE"]
      : contract.status === "PROPOSED"
        ? ["ACTIVE", "TERMINATED"]
        : contract.status === "ACTIVE" || contract.status === "SUSPENDED"
          ? [
              "SUSPENDED",
              "EXPIRED",
              "TERMINATED",
              ...(contract.status === "SUSPENDED" ? ["ACTIVE"] : []),
            ]
          : [];
  if (options.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="contractId" value={contract.id} />
      <select
        name="toStatus"
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        defaultValue={options[0]}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Input name="note" placeholder="Note (optional)" className="h-9 w-48" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Update
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function DeliveryRecordForm({
  companyId,
  contractId,
}: {
  companyId: string;
  contractId: string;
}) {
  const [state, action, pending] = useActionState(recordContractDeliveryAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="contractId" value={contractId} />
      <Input name="reference" placeholder="Delivery reference" className="w-48" required />
      <Input name="charge" placeholder="Charge" inputMode="decimal" className="w-32" required />
      <Input name="note" placeholder="Note" className="w-48" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Record delivery
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function InvoiceForm({
  companyId,
  contracts,
}: {
  companyId: string;
  contracts: ContractView[];
}) {
  const [state, action, pending] = useActionState(createInvoiceAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Input name="periodStart" type="date" className="w-40" required />
      <Input name="periodEnd" type="date" className="w-40" required />
      <Input name="dueAt" type="date" className="w-40" />
      <select
        name="contractId"
        className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
        required
      >
        <option value="">Select a contract</option>
        {contracts.map((contract) => (
          <option key={contract.id} value={contract.id}>
            {contract.contractNumber} · {contract.title}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={pending}>
        Generate invoice
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function InvoiceStatusForm({
  companyId,
  invoiceId,
  status,
}: {
  companyId: string;
  invoiceId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updateInvoiceStatusAction, initialFormState);
  const target =
    status === "DRAFT"
      ? "ISSUED"
      : status === "ISSUED"
        ? "PAID"
        : status === "OVERDUE"
          ? "PAID"
          : null;
  if (!target) return null;
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="toStatus" value={target} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {target === "ISSUED" ? "Issue" : "Mark paid"}
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}
