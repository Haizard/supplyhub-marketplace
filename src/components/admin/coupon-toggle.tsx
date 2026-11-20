"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { setCouponActiveAction } from "@/features/coupons/admin-actions";
import { initialFormState } from "@/features/identity/form-state";

export function CouponToggle({ couponId, isActive }: { couponId: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(setCouponActiveAction, initialFormState);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="couponId" value={couponId} />
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
