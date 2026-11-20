"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/field";
import { initialFormState } from "@/features/identity/form-state";
import {
  agentTransitionJobAction,
  pingLocationAction,
  recordProofAction,
  requesterTransitionJobAction,
  verifyHandoverAction,
} from "@/features/logistics/actions";
import { JOB_STATUS_LABELS } from "@/features/logistics/status";
import type { DeliveryJobStatus } from "@/generated/prisma/enums";

const ACTIVE: DeliveryJobStatus[] = ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"];

function tone(status: DeliveryJobStatus): "neutral" | "accent" | "clay" | "success" | "danger" {
  if (status === "DELIVERED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "TRANSIT" || status === "AT_PICKUP") return "clay";
  if (status === "ASSIGNED") return "neutral";
  return "accent";
}

export function JobStatusBadge({ status }: { status: DeliveryJobStatus }) {
  return <Badge tone={tone(status)}>{JOB_STATUS_LABELS[status]}</Badge>;
}

/** Agent action panel: accept → pickup → transit, OTP, proof, GPS ping. */
export function AgentJobActions({
  jobId,
  status,
  canVerifyOtp,
}: {
  jobId: string;
  status: DeliveryJobStatus;
  canVerifyOtp: boolean;
}) {
  const [transitionState, transitionAction, transitionPending] = useActionState(
    agentTransitionJobAction,
    initialFormState,
  );
  const [otpState, otpAction, otpPending] = useActionState(verifyHandoverAction, initialFormState);
  const [proofState, proofAction, proofPending] = useActionState(
    recordProofAction,
    initialFormState,
  );

  const next: Partial<Record<DeliveryJobStatus, DeliveryJobStatus>> = {
    ASSIGNED: "ACCEPTED",
    ACCEPTED: "TO_PICKUP",
    TO_PICKUP: "AT_PICKUP",
    AT_PICKUP: "TRANSIT",
    TRANSIT: "DELIVERED",
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium">Delivery actions</h3>
      {ACTIVE.includes(status) ? (
        <form action={transitionAction} className="space-y-2">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="toStatus" value={next[status]} />
          <Field label="Note (optional)" htmlFor={`job-note-${jobId}`}>
            <Input
              id={`job-note-${jobId}`}
              name="note"
              maxLength={500}
              placeholder="Add a delivery note"
            />
          </Field>
          <Button type="submit" size="sm" disabled={transitionPending}>
            {status === "TRANSIT"
              ? "Mark delivered"
              : `Move to ${JOB_STATUS_LABELS[next[status]!]}`}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">This delivery is closed.</p>
      )}

      {canVerifyOtp && ACTIVE.includes(status) ? (
        <form action={otpAction} className="space-y-2 border-t border-border pt-4">
          <input type="hidden" name="jobId" value={jobId} />
          <Field
            label="Hand-over code"
            htmlFor={`otp-${jobId}`}
            hint="Ask the buyer for their code"
          >
            <Input
              id={`otp-${jobId}`}
              name="code"
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              maxLength={8}
              placeholder="6-digit code"
              required
            />
          </Field>
          <Button type="submit" size="sm" variant="secondary" disabled={otpPending}>
            Verify code
          </Button>
          {otpState.message ? (
            <p className="text-xs text-muted-foreground">{otpState.message}</p>
          ) : null}
        </form>
      ) : null}

      {ACTIVE.includes(status) ? (
        <form action={proofAction} className="space-y-2 border-t border-border pt-4">
          <input type="hidden" name="jobId" value={jobId} />
          <Field label="Proof of delivery" htmlFor={`proof-${jobId}`}>
            <Select id={`proof-${jobId}`} name="type" defaultValue="PHOTO">
              <option value="PHOTO">Photo</option>
              <option value="SIGNATURE">Signature</option>
            </Select>
          </Field>
          <Input name="storageKey" maxLength={500} placeholder="Stored image key (optional)" />
          <Button type="submit" size="sm" variant="secondary" disabled={proofPending}>
            Record proof
          </Button>
          {proofState.message ? (
            <p className="text-xs text-muted-foreground">{proofState.message}</p>
          ) : null}
        </form>
      ) : null}

      {transitionState.message ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {transitionState.message}
        </p>
      ) : null}
    </div>
  );
}

/** Buyer-side cancellation, plus their own note on the job. */
export function RequesterJobActions({
  jobId,
  status,
}: {
  jobId: string;
  status: DeliveryJobStatus;
}) {
  const [state, action, pending] = useActionState(requesterTransitionJobAction, initialFormState);

  if (!ACTIVE.includes(status)) return null;

  return (
    <form action={action} className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="toStatus" value="CANCELLED" />
      <Field label="Cancellation note" htmlFor={`cancel-note-${jobId}`}>
        <Textarea
          id={`cancel-note-${jobId}`}
          name="note"
          maxLength={500}
          placeholder="Why are you cancelling?"
        />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Cancel delivery
      </Button>
      {state.message ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** GPS ping client. Sends a location to the server on demand. */
export function LocationPing({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(pingLocationAction, initialFormState);

  function share() {
    if (!navigator.geolocation) return;
    const form = document.getElementById(`ping-form-${jobId}`) as HTMLFormElement | null;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = form?.querySelector<HTMLInputElement>('input[name="latitude"]');
        const lng = form?.querySelector<HTMLInputElement>('input[name="longitude"]');
        const heading = form?.querySelector<HTMLInputElement>('input[name="heading"]');
        if (lat) lat.value = String(position.coords.latitude);
        if (lng) lng.value = String(position.coords.longitude);
        if (heading)
          heading.value = position.coords.heading !== null ? String(position.coords.heading) : "";
        form?.requestSubmit();
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  return (
    <form id={`ping-form-${jobId}`} action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="latitude" value="" />
      <input type="hidden" name="longitude" value="" />
      <input type="hidden" name="heading" value="" />
      <Button type="button" size="sm" variant="secondary" onClick={share} disabled={pending}>
        Share my location
      </Button>
      {state.message ? <p className="mt-1 text-xs text-muted-foreground">{state.message}</p> : null}
    </form>
  );
}

export function JobTimeline({
  history,
}: {
  history: { id: string; toStatus: DeliveryJobStatus; note: string | null; createdAt: Date }[];
}) {
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {history.map((event) => (
        <li key={event.id} className="relative text-sm">
          <span
            className="absolute top-2 -left-[21px] size-2 rounded-full bg-accent"
            aria-hidden="true"
          />
          <p className="font-medium">{JOB_STATUS_LABELS[event.toStatus]}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(event.createdAt).toLocaleString()}
            {event.note ? ` · ${event.note}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
