"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinCampaignAction, leaveCampaignAction } from "@/features/groupbuy/actions";
import { initialFormState } from "@/features/identity/form-state";

export function JoinForm({ campaignId, hasJoined }: { campaignId: string; hasJoined: boolean }) {
  const [state, action, pending] = useActionState(
    hasJoined ? leaveCampaignAction : joinCampaignAction,
    initialFormState,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      {state.status === "error" && state.message ? (
        <p className="rounded-md border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="rounded-md border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-success">
          {state.message}
        </p>
      ) : null}

      {!hasJoined ? (
        <>
          <div>
            <label htmlFor="quantity" className="mb-1 block text-sm font-medium">
              Quantity
            </label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={1000}
              defaultValue={1}
              required
            />
          </div>
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Joining..." : "Join campaign"}
          </Button>
        </>
      ) : (
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Leaving..." : "Leave campaign"}
        </Button>
      )}
    </form>
  );
}
