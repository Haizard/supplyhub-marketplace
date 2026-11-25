"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  acceptOpportunityAction,
  autoOfferOpportunityAction,
  createOpportunityAction,
  declineOpportunityAction,
  expireOpportunitiesAction,
  offerOpportunityAction,
} from "@/features/logistics-marketplace/actions";
import { initialFormState } from "@/features/identity/form-state";

export function OpportunityForm({ requestIds }: { requestIds: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createOpportunityAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Request" htmlFor="opRequest">
        <select
          id="opRequest"
          name="requestId"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          required
        >
          <option value="">Select a pending request</option>
          {requestIds.map((request) => (
            <option key={request.id} value={request.id}>
              {request.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Vehicle type" htmlFor="opVehicle">
        <select
          id="opVehicle"
          name="vehicleType"
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
          defaultValue=""
        >
          <option value="">Any</option>
          <option value="BICYCLE">Bicycle</option>
          <option value="MOTORCYCLE">Motorcycle</option>
          <option value="CAR">Car</option>
          <option value="VAN">Van</option>
          <option value="TRUCK">Truck</option>
        </select>
      </Field>
      <Field label="Expires" htmlFor="opExpiry">
        <Input id="opExpiry" name="expiresAt" type="datetime-local" required />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        Publish opportunity
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function OfferForm({
  opportunityId,
  companies,
}: {
  opportunityId: string;
  companies: { id: string; name: string; score: string; eligible: boolean }[];
}) {
  const [state, action, pending] = useActionState(offerOpportunityAction, initialFormState);
  const eligible = companies.filter((company) => company.eligible);
  if (eligible.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <select
        name="companyId"
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        defaultValue={eligible[0]?.id}
      >
        {eligible.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name} · score {company.score}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Offer
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function AutoOfferForm({ opportunityId }: { opportunityId: string }) {
  const [state, action, pending] = useActionState(autoOfferOpportunityAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Offer to best company
      </Button>
      {state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

export function AcceptOpportunityForm({
  companyId,
  opportunityId,
}: {
  companyId: string;
  opportunityId: string;
}) {
  const [state, action, pending] = useActionState(acceptOpportunityAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        Accept
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function DeclineOpportunityForm({
  companyId,
  opportunityId,
}: {
  companyId: string;
  opportunityId: string;
}) {
  const [state, action, pending] = useActionState(declineOpportunityAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Input name="reason" placeholder="Reason" className="h-9 w-48" required />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Decline
      </Button>
      {state.message ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}

export function ExpireOpportunitiesForm() {
  const [state, action, pending] = useActionState(expireOpportunitiesAction, initialFormState);
  return (
    <form action={action} className="space-y-1">
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Expire old offers
      </Button>
      {state.status !== "idle" && state.message ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}
