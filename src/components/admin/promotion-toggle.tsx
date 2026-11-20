"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/identity/form-state";
import { setPromotionActiveAction } from "@/features/promotions/admin-actions";

export function PromotionToggle({
  promotionId,
  isActive,
}: {
  promotionId: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(setPromotionActiveAction, initialFormState);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="promotionId" value={promotionId} />
      <input type="hidden" name="active" value={isActive ? "0" : "1"} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {isActive ? "Pause" : "Activate"}
      </Button>
      <span className="text-right text-xs text-muted-foreground" aria-live="polite">
        {state.message ?? ""}
      </span>
    </form>
  );
}
