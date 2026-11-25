"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  advanceReferralAction,
  createReferralAction,
  registerMerchantReferralAction,
  updateRewardStatusAction,
} from "@/features/partner-growth/actions";
import { initialFormState } from "@/features/identity/form-state";

export function ReferralForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createReferralAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <Field label="Label" htmlFor="refLabel">
        <Input id="refLabel" name="label" placeholder="Arusha shop drive" required />
      </Field>
      <Field label="Code" htmlFor="refCode" error={state.fieldErrors?.code}>
        <Input id="refCode" name="code" placeholder="arusha-drive" required />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        Create referral link
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function RegisterReferralForm({
  companyId,
  referralId,
  clients,
}: {
  companyId: string;
  referralId: string;
  clients: { id: string; name: string; verified: boolean }[];
}) {
  const [state, action, pending] = useActionState(registerMerchantReferralAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="referralId" value={referralId} />
      <select
        name="clientId"
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        required
      >
        <option value="">Attribute a merchant</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
            {client.verified ? " · verified" : ""}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Attribute
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function AdvanceReferralForm({
  companyId,
  referralId,
  status,
}: {
  companyId: string;
  referralId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(advanceReferralAction, initialFormState);
  const next = status === "REGISTERED" ? "VERIFIED" : status === "VERIFIED" ? "QUALIFIED" : null;
  if (!next) return null;
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="referralId" value={referralId} />
      <input type="hidden" name="toStatus" value={next} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {next === "VERIFIED" ? "Confirm verified merchant" : "Check volume milestone"}
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function RewardStatusForm({ companyId, rewardId }: { companyId: string; rewardId: string }) {
  const [state, action, pending] = useActionState(updateRewardStatusAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="rewardId" value={rewardId} />
      <select
        name="toStatus"
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        defaultValue="PAID"
      >
        <option value="PAID">Mark paid</option>
        <option value="INELIGIBLE">Mark ineligible</option>
      </select>
      <Input name="reference" placeholder="Payment reference" className="h-9 w-40" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Update
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}
