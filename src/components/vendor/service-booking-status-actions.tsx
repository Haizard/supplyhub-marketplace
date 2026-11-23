"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/identity/form-state";
import { updateServiceBookingStatusAction } from "@/features/services/actions";
import { BOOKING_TRANSITIONS } from "@/features/services/status";
import type { ServiceBookingStatus } from "@/generated/prisma/enums";
import { useT } from "@/i18n/client";

const ACTION_LABELS: Partial<Record<ServiceBookingStatus, string>> = {
  CONFIRMED: "services.confirm",
  IN_PROGRESS: "Start",
  COMPLETED: "services.complete",
  CANCELLED: "services.cancel",
  NO_SHOW: "services.noShow",
};

export function ServiceBookingStatusActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: ServiceBookingStatus;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(
    updateServiceBookingStatusAction,
    initialFormState,
  );
  const transitions = BOOKING_TRANSITIONS[status] ?? [];

  if (transitions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {transitions.map((to) => (
          <form key={to} action={action}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="toStatus" value={to} />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              {ACTION_LABELS[to] ? t(ACTION_LABELS[to]) : to}
            </Button>
          </form>
        ))}
      </div>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-danger">{state.message}</p>
      ) : null}
    </div>
  );
}
